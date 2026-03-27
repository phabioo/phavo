import { env } from '@phavo/types/env';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const viteEnv = loadEnv(mode, process.cwd(), '');
  process.env.PHAVO_PORT = viteEnv.PHAVO_PORT || process.env.PHAVO_PORT;

  return {
    plugins: [sveltekit()],
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
