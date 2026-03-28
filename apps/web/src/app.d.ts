// See https://kit.svelte.dev/docs/types#app for information about these interfaces

declare global {
  const PHAVO_VERSION: string;

  namespace App {
    // interface Error {}
    interface Locals {
      /**
       * Per-request CSP nonce. Set by SvelteKit when csp.mode is 'nonce' (svelte.config.js).
       * Injected into SvelteKit-generated inline scripts automatically.
       * Read in hooks.server.ts after resolve() to build the Content-Security-Policy header.
       */
      nonce?: string;
    }
    // interface PageData {}
    // interface Platform {}
  }
}

export {};
