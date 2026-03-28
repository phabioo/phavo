import type { PiholeMetrics } from '@phavo/types';
import { z } from 'zod';

export type { PiholeMetrics } from '@phavo/types';

const PiholeApiResponseSchema = z.object({
  queries: z.object({
    total: z.number(),
    blocked: z.number(),
    percent_blocked: z.number(),
  }),
  gravity: z.object({
    domains_being_blocked: z.number(),
  }),
  ftl: z.object({
    status: z.string(),
  }),
});

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

  const raw: unknown = await response.json();
  const parsed = PiholeApiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid Pi-hole response: ${parsed.error.issues[0]?.message ?? 'unknown'}`);
  }

  const data = parsed.data;

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
