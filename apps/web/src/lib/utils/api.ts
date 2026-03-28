export function getCsrfToken(): string {
  return document.cookie.match(/phavo_csrf=([^;]+)/)?.[1] ?? '';
}

export function fetchWithCsrf(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRF-Token', getCsrfToken());
  }
  return fetch(url, { ...init, headers });
}
