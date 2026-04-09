<script lang="ts">
  import type { RssFeedResult, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';
  import { relativeTime } from '$lib/utils/time';

  interface Props {
    data: RssFeedResult;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();
</script>

{#if size === 'S'}
  <div class="rss-s">
    <span class="widget-category-label">RSS FEED</span>
    <span class="rss-s-value hero-glow">
      {data.items.length}<span class="rss-s-unit"> items</span>
    </span>
  </div>
{:else if size === 'M'}
  <div class="rss-m">
    <div class="widget-header">
      <span class="widget-category-label">RSS FEED</span>
      <Icon name="rss" size={18} class="widget-icon" />
    </div>

    {#if data.items.length === 0}
      <div class="rss-empty">
        <Icon name="rss" size={20} />
        <span>No feed items</span>
      </div>
    {:else}
      <div class="rss-list">
        {#each data.items.slice(0, 4) as item}
          <a class="rss-item" href={item.link} target="_blank" rel="noopener noreferrer">
            <span class="rss-item-title">{item.title}</span>
            <div class="rss-item-meta">
              <span class="rss-item-source">{item.source}</span>
              <span class="rss-item-time">{relativeTime(new Date(item.publishedAt))}</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="rss-l">
    <div class="widget-header">
      <span class="widget-category-label">RSS FEED</span>
      <Icon name="rss" size={18} class="widget-icon" />
    </div>

    {#if data.items.length === 0}
      <div class="rss-empty">
        <Icon name="rss" size={20} />
        <span>No feed items</span>
      </div>
    {:else}
      <div class="rss-list">
        {#each data.items.slice(0, 8) as item}
          <a class="rss-item" href={item.link} target="_blank" rel="noopener noreferrer">
            <span class="rss-item-title">{item.title}</span>
            <div class="rss-item-meta">
              <span class="rss-item-source">{item.source}</span>
              <span class="rss-item-time">{relativeTime(new Date(item.publishedAt))}</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ── S size ─────────────────────────────────────────── */
  .rss-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    padding: var(--space-4);
    gap: var(--space-1);
  }

  .rss-s-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
  }

  .rss-s-unit {
    font-size: 16px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  /* ── M/L/XL shared ──────────────────────────────────── */
  .rss-m,
  .rss-l {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    gap: var(--space-4);
  }

  /* ── Empty state ────────────────────────────────────── */
  .rss-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
    color: var(--color-outline);
    font-size: 13px;
    flex: 1;
    justify-content: center;
  }

  /* ── Article list ───────────────────────────────────── */
  .rss-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .rss-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-decoration: none;
    padding: var(--space-1) 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
  }

  .rss-item:last-child {
    border-bottom: none;
  }

  .rss-item-title {
    font-size: 13px;
    color: var(--color-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rss-item:hover .rss-item-title {
    color: var(--color-primary-fixed);
  }

  .rss-item-meta {
    display: flex;
    gap: var(--space-2);
    font-size: 11px;
  }

  .rss-item-source {
    color: var(--color-outline);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
  }

  .rss-item-time {
    color: var(--color-secondary);
  }
</style>