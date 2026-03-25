import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    return new Response('Missing code or state', { status: 400 });
  }

  // TODO: Exchange code with phavo.io for token, create session
  return new Response(null, {
    status: 302,
    headers: { Location: '/' },
  });
};
