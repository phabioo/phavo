export interface RssFeedConfig {
  url: string;
  auth?: {
    type: 'basic' | 'bearer';
    value: string;
  };
}

export interface RssFeedItem {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
}

export interface RssFeedError {
  feedUrl: string;
  error: string;
}

export interface RssFeedResult {
  items: RssFeedItem[];
  errors: RssFeedError[];
}

async function fetchFeed(config: RssFeedConfig): Promise<RssFeedItem[]> {
  const headers: Record<string, string> = {};

  if (config.auth) {
    if (config.auth.type === 'bearer') {
      headers.Authorization = `Bearer ${config.auth.value}`;
    } else {
      headers.Authorization = `Basic ${config.auth.value}`;
    }
  }

  const response = await fetch(config.url, { headers });

  if (!response.ok) {
    throw new Error(`Feed fetch error: ${response.status}`);
  }

  const text = await response.text();
  return parseXmlFeed(text, config.url);
}

function parseXmlFeed(xml: string, sourceUrl: string): RssFeedItem[] {
  const items: RssFeedItem[] = [];

  // Extract source name from URL
  let source: string;
  try {
    source = new URL(sourceUrl).hostname;
  } catch {
    source = sourceUrl;
  }

  // Try RSS <item> elements
  const rssItemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  // Try Atom <entry> elements
  const atomEntryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;

  const rssItems = xml.matchAll(rssItemRegex);
  const atomEntries = xml.matchAll(atomEntryRegex);

  for (const match of rssItems) {
    const content = match[1] ?? '';
    const title = extractTag(content, 'title');
    const link = extractTag(content, 'link');
    const pubDate = extractTag(content, 'pubDate');

    items.push({
      title: title || 'Untitled',
      link: link || '',
      source,
      publishedAt: pubDate || new Date().toISOString(),
    });
  }

  if (items.length === 0) {
    for (const match of atomEntries) {
      const content = match[1] ?? '';
      const title = extractTag(content, 'title');
      const linkMatch = content.match(/<link[^>]+href="([^"]*)"[^>]*\/?>/);
      const link = linkMatch?.[1] ?? extractTag(content, 'link');
      const published = extractTag(content, 'published') || extractTag(content, 'updated');

      items.push({
        title: title || 'Untitled',
        link: link || '',
        source,
        publishedAt: published || new Date().toISOString(),
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  const cdataMatch = xml.match(
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i'),
  );
  if (cdataMatch?.[1]) return cdataMatch[1].trim();

  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match?.[1]?.trim() ?? '';
}

export async function getRss(feeds: RssFeedConfig[]): Promise<RssFeedResult> {
  const items: RssFeedItem[] = [];
  const errors: RssFeedError[] = [];

  const results = await Promise.allSettled(feeds.map((feed) => fetchFeed(feed)));

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result) continue;

    if (result?.status === 'fulfilled') {
      items.push(...result.value);
    } else {
      const feedUrl = feeds[i]?.url ?? `feed-${i}`;
      errors.push({
        feedUrl,
        error: result.reason instanceof Error ? result.reason.message : 'Failed to load RSS feed',
      });
    }
  }

  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return { items, errors };
}
