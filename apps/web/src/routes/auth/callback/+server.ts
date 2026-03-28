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

function getSetCookieValues(headers: Headers): string[] {
  const candidate = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof candidate.getSetCookie === 'function') {
    return candidate.getSetCookie();
  }

  const value = headers.get('set-cookie');
  return value ? [value] : [];
}

export const GET: RequestHandler = async ({ url }) => {
  const code = url.searchParams.get('code');
  const oauthState = decodeState(url.searchParams.get('state'));
  const mode = oauthState.mode === 'quick' ? 'quick' : 'full';

  if (!code) {
    return new Response(null, {
      status: 303,
      headers: { Location: `/setup?oauth=error&mode=${mode}&message=Missing%20code` },
    });
  }

  const loginResponse = await fetch(`${url.origin}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authMode: 'phavo-net', code }),
  });

  const json = (await loginResponse.json().catch(() => null)) as
    | { ok: true }
    | { ok: false; error?: string }
    | null;

  const nextLocation =
    json && 'ok' in json && json.ok
      ? `/setup?oauth=success&mode=${mode}`
      : `/setup?oauth=error&mode=${mode}&message=${encodeURIComponent(
          json && 'error' in json
            ? (json.error ?? 'Authentication failed')
            : 'Authentication failed',
        )}`;

  const headers = new Headers({ Location: nextLocation });
  for (const value of getSetCookieValues(loginResponse.headers)) {
    headers.append('Set-Cookie', value);
  }

  return new Response(null, {
    status: 303,
    headers,
  });
};
