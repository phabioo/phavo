export interface PiholeMetrics {
  totalQueries: number;
  blockedQueries: number;
  percentBlocked: number;
  domainsOnBlocklist: number;
  status: 'enabled' | 'disabled';
}

export async function getPihole(url: string, token: string): Promise<PiholeMetrics> {
  const apiUrl = new URL('/api/stats/summary', url);

  const response = await fetch(apiUrl.toString(), {
    headers: {
      'X-FTL-SID': token,
    },
  });

  if (!response.ok) {
    throw new Error(`Pi-hole API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as {
    queries: { total: number; blocked: number; percent_blocked: number };
    gravity: { domains_being_blocked: number };
    ftl: { status: string };
  };

  return {
    totalQueries: data.queries.total,
    blockedQueries: data.queries.blocked,
    percentBlocked: data.queries.percent_blocked,
    domainsOnBlocklist: data.gravity.domains_being_blocked,
    status: data.ftl.status === 'enabled' ? 'enabled' : 'disabled',
  };
}

export async function setPiholeStatus(url: string, token: string, enabled: boolean): Promise<void> {
  const action = enabled ? 'enable' : 'disable';
  const apiUrl = new URL(`/api/dns/blocking`, url);

  const response = await fetch(apiUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-FTL-SID': token,
    },
    body: JSON.stringify({ blocking: enabled }),
  });

  if (!response.ok) {
    throw new Error(`Pi-hole API error setting ${action}: ${response.status}`);
  }
}
