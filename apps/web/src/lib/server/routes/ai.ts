import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { decrypt, encrypt, schema } from '@phavo/db';
import { err, ok } from '@phavo/types';
import { streamText } from 'ai';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { createOllama } from 'ollama-ai-provider';
import { z } from 'zod';
import { db } from '$lib/server/db.js';
import type { AppVariables } from '$lib/server/middleware/auth.js';
import { requireSession, requireTier } from '$lib/server/middleware/auth.js';
import { assertNotCloudMetadata } from '$lib/server/security.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AiChatSchema = z.object({
  prompt: z.string().min(1).max(2000),
});

const AiConfigSchema = z.object({
  aiProvider: z.enum(['ollama', 'openai', 'anthropic', 'google', 'custom']).nullable().optional(),
  searchEngine: z.enum(['duckduckgo', 'google', 'brave', 'custom']).optional(),
  customSearchUrl: z.string().max(500).optional(),
  ollamaUrl: z.string().max(500).optional(),
  ollamaModel: z.string().max(100).optional(),
  openaiKey: z.string().max(500).optional(),
  openaiModel: z.string().max(100).optional(),
  anthropicKey: z.string().max(500).optional(),
  anthropicModel: z.string().max(100).optional(),
  googleKey: z.string().max(500).optional(),
  googleModel: z.string().max(100).optional(),
  customUrl: z.string().max(500).optional(),
  customKey: z.string().max(500).optional(),
  customModel: z.string().max(100).optional(),
});

const OllamaTestSchema = z.object({
  url: z.string().min(1).max(500),
});

const SEARCH_ENGINE_URLS: Record<string, { url: string; name: string }> = {
  duckduckgo: { url: 'https://duckduckgo.com/?q={query}', name: 'DuckDuckGo' },
  google: { url: 'https://www.google.com/search?q={query}', name: 'Google' },
  brave: { url: 'https://search.brave.com/search?q={query}', name: 'Brave Search' },
};

const AI_SYSTEM_PROMPT = `You are a helpful assistant embedded in PHAVO, a self-hosted personal dashboard. You help users understand their system metrics, troubleshoot services, and answer questions concisely.`;

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

async function loadConfigEntries(): Promise<Record<string, string>> {
  const configRows = await db
    .select({ key: schema.config.key, value: schema.config.value })
    .from(schema.config);
  const entries: Record<string, string> = {};
  for (const row of configRows) entries[row.key] = row.value;
  return entries;
}

async function upsertCredential(key: string, plaintext: string): Promise<void> {
  const valueEncrypted = await encrypt(plaintext);
  await db
    .insert(schema.credentials)
    .values({ key, valueEncrypted, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: schema.credentials.key,
      set: { valueEncrypted, updatedAt: Date.now() },
    });
}

async function deleteCredential(key: string): Promise<void> {
  await db.delete(schema.credentials).where(eq(schema.credentials.key, key));
}

// ─── Route registration ─────────────────────────────────────────────────────

export function registerAiRoutes(app: Hono<{ Variables: AppVariables }>): void {
  // GET /ai/status — returns provider availability and search engine config
  app.get('/ai/status', requireSession(), async (c) => {
    try {
      const entries = await loadConfigEntries();

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
      const googleKey = await loadAiCredential('ai:google_key');
      const customKey = await loadAiCredential('ai:custom_key');

      return c.json(
        ok({
          aiProvider: entries.ai_provider ?? null,
          ollama: Boolean(entries.ollama_url),
          openai: Boolean(openaiKey),
          anthropic: Boolean(anthropicKey),
          google: Boolean(googleKey),
          custom: Boolean(entries.custom_ai_url) || Boolean(customKey),
          searchEngineUrl,
          searchEngineName,
          searchEngine: engine,
          customSearchUrl: customUrl,
          ollamaUrl: entries.ollama_url ?? '',
          ollamaModel: entries.ollama_model ?? '',
          openaiModel: entries.openai_model ?? '',
          anthropicModel: entries.anthropic_model ?? '',
          googleModel: entries.google_model ?? '',
          customAiUrl: entries.custom_ai_url ?? '',
          customModel: entries.custom_ai_model ?? '',
          hasOpenaiKey: Boolean(openaiKey),
          hasAnthropicKey: Boolean(anthropicKey),
          hasGoogleKey: Boolean(googleKey),
          hasCustomKey: Boolean(customKey),
        }),
      );
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  // POST /ai/config — persist AI provider settings
  app.post('/ai/config', requireSession(), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = AiConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(err('Invalid AI configuration'), 400);
    }
    const data = parsed.data;

    try {
      // Config KV pairs (non-secret)
      const configPairs: Array<{ key: string; value: string }> = [];
      if (data.aiProvider !== undefined)
        configPairs.push({ key: 'ai_provider', value: data.aiProvider ?? '' });
      if (data.searchEngine !== undefined)
        configPairs.push({ key: 'search_engine', value: data.searchEngine });
      if (data.customSearchUrl !== undefined)
        configPairs.push({ key: 'custom_search_url', value: data.customSearchUrl });
      if (data.ollamaUrl !== undefined)
        configPairs.push({ key: 'ollama_url', value: data.ollamaUrl });
      if (data.ollamaModel !== undefined)
        configPairs.push({ key: 'ollama_model', value: data.ollamaModel });
      if (data.openaiModel !== undefined)
        configPairs.push({ key: 'openai_model', value: data.openaiModel });
      if (data.anthropicModel !== undefined)
        configPairs.push({ key: 'anthropic_model', value: data.anthropicModel });
      if (data.googleModel !== undefined)
        configPairs.push({ key: 'google_model', value: data.googleModel });
      if (data.customUrl !== undefined)
        configPairs.push({ key: 'custom_ai_url', value: data.customUrl });
      if (data.customModel !== undefined)
        configPairs.push({ key: 'custom_ai_model', value: data.customModel });

      for (const pair of configPairs) {
        await db
          .insert(schema.config)
          .values(pair)
          .onConflictDoUpdate({
            target: schema.config.key,
            set: { value: pair.value },
          });
      }

      // Encrypted credential pairs (API keys)
      const credentialMap: Array<{ field: string | undefined; credKey: string }> = [
        { field: data.openaiKey, credKey: 'ai:openai_key' },
        { field: data.anthropicKey, credKey: 'ai:anthropic_key' },
        { field: data.googleKey, credKey: 'ai:google_key' },
        { field: data.customKey, credKey: 'ai:custom_key' },
      ];

      for (const { field, credKey } of credentialMap) {
        if (field !== undefined) {
          if (field) {
            await upsertCredential(credKey, field);
          } else {
            await deleteCredential(credKey);
          }
        }
      }

      return c.json(ok(null));
    } catch (e) {
      console.error('[phavo]', e);
      return c.json(err('Internal error'), 500);
    }
  });

  // POST /ai/test-ollama — test connectivity to an Ollama instance
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

  // POST /ai/chat — streaming AI chat via SSE (Celestial only)
  app.post('/ai/chat', requireSession(), requireTier('celestial'), async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = AiChatSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(err('prompt required'), 400);
    }
    const { prompt } = parsed.data;

    const entries = await loadConfigEntries();
    const provider = entries.ai_provider;

    if (!provider) {
      return c.json(err('no_provider_configured'), 400);
    }

    // biome-ignore lint/suspicious/noExplicitAny: ollama-ai-provider returns LanguageModelV1, SDK v6 expects V2/V3 at type level but handles V1 at runtime
    let model: any;
    try {
      switch (provider) {
        case 'ollama': {
          const ollamaUrl = entries.ollama_url;
          if (!ollamaUrl) {
            return c.json(err('Ollama URL not configured'), 400);
          }
          assertNotCloudMetadata(ollamaUrl);
          const ollama = createOllama({
            baseURL: `${ollamaUrl.replace(/\/+$/, '')}/api`,
          });
          model = ollama(entries.ollama_model || 'llama3.2');
          break;
        }
        case 'openai': {
          const key = await loadAiCredential('ai:openai_key');
          if (!key) return c.json(err('openai_key_missing'), 400);
          const openai = createOpenAI({ apiKey: key });
          model = openai(entries.openai_model || 'gpt-4o-mini');
          break;
        }
        case 'anthropic': {
          const key = await loadAiCredential('ai:anthropic_key');
          if (!key) return c.json(err('anthropic_key_missing'), 400);
          const anthropic = createAnthropic({ apiKey: key });
          model = anthropic(entries.anthropic_model || 'claude-haiku-4-5-20251001');
          break;
        }
        case 'google': {
          const key = await loadAiCredential('ai:google_key');
          if (!key) return c.json(err('google_key_missing'), 400);
          const google = createGoogleGenerativeAI({ apiKey: key });
          model = google(entries.google_model || 'gemini-2.0-flash');
          break;
        }
        case 'custom': {
          const key = await loadAiCredential('ai:custom_key');
          const baseURL = entries.custom_ai_url;
          if (baseURL) assertNotCloudMetadata(baseURL);
          const openai = createOpenAI({
            ...(baseURL ? { baseURL } : {}),
            apiKey: key || 'none',
          });
          model = openai(entries.custom_ai_model || 'default');
          break;
        }
        default:
          return c.json(err('unknown_provider'), 400);
      }
    } catch {
      return c.json(err('provider_init_failed'), 500);
    }

    return streamSSE(c, async (stream) => {
      try {
        const { textStream } = streamText({ model, system: AI_SYSTEM_PROMPT, prompt });
        let id = 0;
        for await (const chunk of textStream) {
          await stream.writeSSE({
            data: JSON.stringify({ text: chunk }),
            event: 'chunk',
            id: String(id++),
          });
        }
        await stream.writeSSE({
          data: JSON.stringify({ done: true }),
          event: 'done',
          id: String(id++),
        });
      } catch {
        await stream.writeSSE({
          data: JSON.stringify({ error: 'stream_failed' }),
          event: 'error',
          id: '0',
        });
      }
    });
  });
}
