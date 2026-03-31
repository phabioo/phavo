<script lang="ts">
  import type { RssFeedResult, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';
  import { relativeTime } from '$lib/utils/time';

  interface Props {
    data: RssFeedResult;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const sources = $derived([...new Set(data.items.map(i => i.source))]);
</script>

<div class="rss-widget">
  {#if size === 'S'}
    <div class="s-row">
      <Icon name="rss" size={16} class="text-accent" />
      <span class="metric-value mono">{data.items.length}</span>
      <span class="s-label">items</span>
    </div>
  {:else}
    {#if data.items.length === 0}
      <div class="empty">
        <Icon name="rss" size={20} />
        <span>No feed items</span>
      </div>
    {:else}
      <div class="item-list">
        {#each data.items.slice(0, size === 'XL' ? 10 : 5) as item}
          <a class="feed-item" href={item.link} target="_blank" rel="noopener noreferrer">
            <span class="item-title">{item.title}</span>
            <div class="item-meta">
              <span class="item-source">{item.source}</span>
              <span class="item-time">{relativeTime(new Date(item.publishedAt))}</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .rss-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .s-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .metric-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .s-label {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  .item-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .feed-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-decoration: none;
    padding: var(--space-1) 0;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .feed-item:last-child {
    border-bottom: none;
  }

  .item-title {
    font-size: 13px;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .feed-item:hover .item-title {
    color: var(--color-accent-text);
  }

  .item-meta {
    display: flex;
    gap: var(--space-2);
    font-size: 11px;
  }

  .item-source {
    color: var(--color-accent-text);
  }

  .item-time {
    color: var(--color-text-muted);
  }
</style>