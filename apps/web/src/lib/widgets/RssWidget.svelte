<script lang="ts">
  import type { RssFeedResult } from '@phavo/agent';

  interface Props {
    data: RssFeedResult;
  }

  let { data }: Props = $props();

  const hasItems = $derived(data.items.length > 0);

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 0) return 'just now';
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
</script>

<div class="rss-widget">
  {#if !hasItems}
    <div class="empty-state">
      <span class="empty-icon" aria-hidden="true">📰</span>
      <p class="empty-message">No feeds configured — add RSS URLs in Settings.</p>
    </div>
  {:else}
    <ul class="feed-list">
      {#each data.items as item (item.link)}
        <li class="feed-item">
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            class="item-title"
          >{item.title}</a>
          <div class="item-meta">
            <span class="item-source">{item.source}</span>
            <span class="item-time">{timeAgo(item.publishedAt)}</span>
          </div>
        </li>
      {/each}
    </ul>

    {#if data.errors.length > 0}
      <p class="failed-note">{data.errors.length} feed{data.errors.length > 1 ? 's' : ''} could not be loaded.</p>
    {/if}
  {/if}
</div>

<style>
  .rss-widget {
    display: flex;
    flex-direction: column;
  }

  /* --- Empty state --- */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-6) var(--space-4);
    text-align: center;
  }

  .empty-icon {
    font-size: 2rem;
    line-height: 1;
  }

  .empty-message {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    max-width: 20ch;
  }

  /* --- Feed list --- */
  .feed-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .feed-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .feed-item:last-child {
    border-bottom: none;
  }

  .item-title {
    font-size: 0.875rem;
    color: var(--color-text);
    text-decoration: none;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }

  .item-title:hover {
    color: var(--color-accent);
    text-decoration: underline;
  }

  .item-meta {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .item-source {
    font-size: 0.72rem;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .item-time {
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }

  .failed-note {
    margin: var(--space-2) 0 0;
    font-size: 0.75rem;
    color: var(--color-warning);
  }
</style>
