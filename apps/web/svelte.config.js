import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      $lib: './src/lib',
    },
    // Enable per-request nonce generation. SvelteKit injects the nonce into its own
    // inline scripts and sets event.locals.nonce so hooks.server.ts can build the
    // Content-Security-Policy header dynamically. No directives here — the full
    // CSP is assembled manually in the handle hook.
    csp: {
      mode: 'nonce',
    },
  },
};

export default config;
