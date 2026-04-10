import type { RequestHandler } from '@sveltejs/kit';

type OauthSetupState = {
  source?: string;
  mode?: 'quick' | 'full';
};

function decodeState(rawState: string | null): OauthSetupState {
  if (!rawState) return {};

  try {
    return JSON.parse(atob(rawState)) as OauthSetupState;
  } catch {
    return {};
  }
}

export const GET: RequestHandler = async ({ url }) => {
  const oauthState = decodeState(url.searchParams.get('state'));
  const mode = oauthState.mode === 'quick' ? 'quick' : 'full';
  return new Response(null, {
    status: 303,
    headers: {
      Location: `/setup?mode=${mode}&message=${encodeURIComponent('Online callback is disabled in local-only mode')}`,
    },
  });
};
