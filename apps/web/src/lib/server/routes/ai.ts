import { decrypt, encrypt, schema } from '@phavo/db';
import { err, ok } from '@phavo/types';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import { db } from '$lib/server/db.js';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession } from '$lib/server/middleware/auth.js';
import { assertNotCloudMetadata } from '$lib/server/security.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AiChatSchema = z.object({
  provider: z.enum(['ollama', 'openai', 'anthropic']),
  query: z.string().min(1).max(2000),
});

const AiConfigSchema = z.object({
  searchEngine: z.enum(['duckduckgo', 'google', 'brave', 'custom']).optional(),
  customSearchUrl: z.string().max(500).optional(),
  ollamaUrl: z.string().max(500).optional(),
  ollamaModel: z.string().max(100).optional(),
  openaiKey: z.string().max(500).optional(),
  anthropicKey: z.string().max(500).optional(),
});

const OllamaTestSchema = z.object({
  url: z.string().min(1).max(500),
});

const SEARCH_ENGINE_URLS: Record<string, { url: string; name: string }> = {
  duckduckgo: { url: 'https://duckduckgo.com/?q={query}', name: 'DuckDuckGo' },
  google: { url: 'https://www.google.com/search?q={query}', name: 'Google' },
  brave: { url: 'https://search.brave.com/search?q={query}', name: 'Brave Search' },
};

async function loadAiCredential(key: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(schema.credentials)
    .where(eq(schema.credentials.key, key))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  try {
    return await decrypt(row.valueEncrypted);
  } catch {
    return null;
  }
}

// ─── Route registration ─────────────────────────────────────────────────────

export function registerAiRoutes(app: Hono<{ Variables: AppVariables }>): void {
  app.get('/ai/status', requireSession(), async (c) => {
    try {
      const configRows = await db
        .select({ key: schema.config.key, value: schema.config.value })
        .from(schema.config);
      const entries: Record<string, string> = {};
      for (const row of configRows) entries[row.key] = row.value;

      const engine = entries.search_engine ?? 'duckduckgo';
      const customUrl = entries.custom_search_url ?? '';
      const preset = SEARCH_ENGINE_URLS[engine];
      const duckduckgoPreset = SEARCH_ENGINE_URLS.duckduckgo;
      const searchEngineUrl =
        engine === 'custom' && customUrl
          ? customUrl
          : (preset?.url ?? duckduckgoPreset?.url ?? 'https://duckduckgo.com/?q={query}');
      const searchEngineName = engine === 'custom' ? 'Web' : (preset?.name ?? 'DuckDuckGo');

      const openaiKey = await loadAiCredential('ai:openai_key');
      const anthropicKey = await loadAiCredential('ai:anthropic_key');

      return c.json(
        ok({
          ollama: Boolean(entries.ollama_url),
          openai: Boolean(openaiKey),
          anthropic: Boolean(anthropicKey),
          searchEngineUrl,
          searchEngineName,
          searchEngine: engine,
          customSearchUrl: customUrl,
          ollamaUrl: entries.ollama_url ?? '',
          ollamaModel: entries.ollama_model ?? '',
          hasOpenaiKey: Boolean(openaiKey),
          hasAnthropicKey: Boolean(anthropicKey),
        }),
      );
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  app.post('/ai/config', requireSession(), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = AiConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(err('Invalid AI configuration'), 400);
    }
    const data = parsed.data;

    try {
      const configPairs: Array<{ key: string; value: string }> = [];
      if (data.searchEngine !== undefined)
        configPairs.push({ key: 'search_engine', value: data.searchEngine });
      if (data.customSearchUrl !== undefined)
        configPairs.push({ key: 'custom_search_url', value: data.customSearchUrl });
      if (data.ollamaUrl !== undefined)
        configPairs.push({ key: 'ollama_url', value: data.ollamaUrl });
      if (data.ollamaModel !== undefined)
        configPairs.push({ key: 'ollama_model', value: data.ollamaModel });

      for (const pair of configPairs) {
        await db
          .insert(schema.config)
          .values(pair)
          .onConflictDoUpdate({
            target: schema.config.key,
            set: { value: pair.value },
          });
      }

      if (data.openaiKey !== undefined) {
        if (data.openaiKey) {
          const valueEncrypted = await encrypt(data.openaiKey);
          await db
            .insert(schema.credentials)
            .values({ key: 'ai:openai_key', valueEncrypted, updatedAt: Date.now() })
            .onConflictDoUpdate({
              target: schema.credentials.key,
              set: { valueEncrypted, updatedAt: Date.now() },
            });
        } else {
          await db.delete(schema.credentials).where(eq(schema.credentials.key, 'ai:openai_key'));
        }
      }

      if (data.anthropicKey !== undefined) {
        if (data.anthropicKey) {
          const valueEncrypted = await encrypt(data.anthropicKey);
          await db
            .insert(schema.credentials)
            .values({ key: 'ai:anthropic_key', valueEncrypted, updatedAt: Date.now() })
            .onConflictDoUpdate({
              target: schema.credentials.key,
              set: { valueEncrypted, updatedAt: Date.now() },
            });
        } else {
          await db.delete(schema.credentials).where(eq(schema.credentials.key, 'ai:anthropic_key'));
        }
      }

      return c.json(ok(null));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  app.post('/ai/test-ollama', requireSession(), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = OllamaTestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(err('Invalid URL'), 400);
    }
    try {
      try {
        assertNotCloudMetadata(parsed.data.url);
      } catch {
        return c.json(err('Invalid Ollama URL'), 400);
      }

      let tagUrl: URL;
      try {
        tagUrl = new URL('/api/tags', parsed.data.url);
      } catch {
        return c.json(err('Invalid Ollama URL'), 400);
      }
      if (tagUrl.protocol !== 'http:' && tagUrl.protocol !== 'https:') {
        return c.json(err('URL must use http or https'), 400);
      }
      const resp = await fetch(tagUrl.toString(), {
        signal: AbortSignal.timeout(5_000),
      });
      if (!resp.ok) {
        return c.json(err(`Ollama returned ${resp.status}`), 502);
      }
      return c.json(ok(null));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return c.json(err('Connection timed out'), 504);
      }
      return c.json(err('Failed to connect to Ollama'), 502);
    }
  });

  app.post('/ai/chat', requireSession(), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = AiChatSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(err('Invalid request: provider and query are required'), 400);
    }
    const { provider, query } = parsed.data;

    try {
      if (provider === 'ollama') {
        const configRows = await db
          .select({ key: schema.config.key, value: schema.config.value })
          .from(schema.config);
        const entries: Record<string, string> = {};
        for (const row of configRows) entries[row.key] = row.value;
        const ollamaUrl = entries.ollama_url;
        if (!ollamaUrl) {
          return c.json(err('Ollama URL not configured'), 400);
        }

        try {
          assertNotCloudMetadata(ollamaUrl);
        } catch {
          return c.json(err('Invalid Ollama URL'), 400);
        }

        let parsedUrl: URL;
        try {
          parsedUrl = new URL('/api/generate', ollamaUrl);
        } catch {
          return c.json(err('Invalid Ollama URL'), 400);
        }
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          return c.json(err('Ollama URL must use http or https'), 400);
        }
        const ollamaModel = entries.ollama_model ?? 'llama3.2';
        const resp = await fetch(parsedUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: ollamaModel, prompt: query, stream: false }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!resp.ok) {
          return c.json(err(`Ollama returned ${resp.status}`), 502);
        }
        const data = await resp.json();
        const OllamaResponseSchema = z.object({ response: z.string() });
        const ollamaParsed = OllamaResponseSchema.safeParse(data);
        if (!ollamaParsed.success) {
          return c.json(err('Unexpected response from Ollama'), 502);
        }
        return c.json(ok({ text: ollamaParsed.data.response }));
      }

      if (provider === 'openai') {
        const apiKey = await loadAiCredential('ai:openai_key');
        if (!apiKey) {
          return c.json(err('OpenAI API key not configured'), 400);
        }
        const resp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: query }],
            max_tokens: 1024,
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!resp.ok) {
          return c.json(err(`OpenAI returned ${resp.status}`), 502);
        }
        const data = await resp.json();
        const OpenAIResponseSchema = z.object({
          choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
        });
        const openaiParsed = OpenAIResponseSchema.safeParse(data);
        if (!openaiParsed.success) {
          return c.json(err('Unexpected response from OpenAI'), 502);
        }
        const firstChoice = openaiParsed.data.choices[0];
        if (!firstChoice) {
          return c.json(err('Empty response from OpenAI'), 502);
        }
        return c.json(ok({ text: firstChoice.message.content }));
      }

      if (provider === 'anthropic') {
        const apiKey = await loadAiCredential('ai:anthropic_key');
        if (!apiKey) {
          return c.json(err('Anthropic API key not configured'), 400);
        }
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{ role: 'user', content: query }],
          }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!resp.ok) {
          return c.json(err(`Anthropic returned ${resp.status}`), 502);
        }
        const data = await resp.json();
        const AnthropicResponseSchema = z.object({
          content: z.array(z.object({ type: z.string(), text: z.string() })).min(1),
        });
        const anthropicParsed = AnthropicResponseSchema.safeParse(data);
        if (!anthropicParsed.success) {
          return c.json(err('Unexpected response from Anthropic'), 502);
        }
        const textBlock = anthropicParsed.data.content.find((b) => b.type === 'text');
        return c.json(ok({ text: textBlock?.text ?? '' }));
      }

      return c.json(err('Unsupported provider'), 400);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return c.json(err('AI provider request timed out'), 504);
      }
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });
}
