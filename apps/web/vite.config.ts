import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { env } from '@phavo/types/env';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// @tailwindcss/vite's source scanner runs on every CSS virtual module, including
// Svelte component <style> blocks (?svelte&type=style&lang.css). It tokenises the
// entire .svelte source file — including the <script lang="ts"> block — and treats
// TypeScript type-import tokens (e.g. "UptimeMetrics, WidgetSize") as CSS class
// candidates. The subsequent build step then throws "Invalid declaration" for those
// non-CSS strings. No component in this project uses @apply, so Tailwind does not
// need to transform component style blocks at all; all utilities are generated from
// packages/ui/src/theme.css. This helper appends a Svelte-style-block exclusion
// to the generate plugins' transform filter.
const SVELTE_STYLE_BLOCK = /\.svelte[^?]*\?.*lang\.css/;

function excludeSvelteStylesFromTailwind(plugins: Plugin[]): Plugin[] {
  return plugins.map((plugin) => {
    if (!plugin.name?.startsWith('@tailwindcss/vite:generate')) return plugin;
    const t = plugin.transform as Record<string, unknown> | undefined;
    if (!t || typeof t !== 'object') return plugin;
    const filter = (t.filter as Record<string, unknown>) ?? {};
    const id = (filter.id as Record<string, unknown>) ?? {};
    return {
      ...plugin,
      transform: {
        ...t,
        filter: {
          ...filter,
          id: { ...id, exclude: [...((id.exclude as RegExp[]) ?? []), SVELTE_STYLE_BLOCK] },
        },
      },
    } as Plugin;
  });
}

// Read root package.json for the monorepo version. The try/catch guards against
// running vite config in a non-standard CWD (e.g. buildkit layer under QEMU).
let rootPkg: { version: string } = { version: 'dev' };
try {
  rootPkg = JSON.parse(readFileSync(join(process.cwd(), '../../package.json'), 'utf8'));
} catch {
  // Fallback — PHAVO_VERSION will be 'dev'; the build continues normally.
}

export default defineConfig(({ mode }) => {
  const viteEnv = loadEnv(mode, process.cwd(), '');
  process.env.PHAVO_PORT = viteEnv.PHAVO_PORT || process.env.PHAVO_PORT;

  // Inject env vars that SSR code reads via process.env at dev/build time.
  // Vite does not polyfill process.env for SSR bundles — these must be explicit.
  const processEnvDefines: Record<string, string> = {
    PHAVO_VERSION: JSON.stringify(rootPkg.version),
  };

  return {
    plugins: [...excludeSvelteStylesFromTailwind(tailwindcss()), sveltekit()],
    define: processEnvDefines,
    server: {
      port: env.port,
      strictPort: true,
    },
    ssr: {
      // Workspace packages export raw TypeScript source (.ts files).
      // Vite/esbuild must transform them — Node's native ESM resolver
      // cannot resolve `.js` imports to `.ts` files on its own.
      noExternal: ['@phavo/types', '@phavo/db', '@phavo/agent', '@phavo/ui'],
    },
  };
});
