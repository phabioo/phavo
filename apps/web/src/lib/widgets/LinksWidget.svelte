<script lang="ts">
  import type { WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';

  interface LinkItem {
    title: string;
    url: string;
    icon?: string;
  }

  interface LinkGroup {
    label: string;
    links: LinkItem[];
  }

  interface Props {
    data: { groups: LinkGroup[] };
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const hasLinks = $derived(data.groups.length > 0);
  const totalLinks = $derived(data.groups.reduce((s, g) => s + g.links.length, 0));
</script>

{#if size === 'S'}
  {#if !hasLinks}
    <div class="links-s">
      <span class="widget-category-label">LINKS</span>
      <span class="links-s-empty">No links configured</span>
    </div>
  {:else}
    <div class="links-s">
      <span class="widget-category-label">LINKS</span>
      <span class="links-s-value hero-glow">
        {totalLinks}<span class="links-s-unit"> links</span>
      </span>
    </div>
  {/if}
{:else if size === 'M'}
  <div class="links-m">
    <div class="widget-header">
      <span class="widget-category-label">LINKS</span>
      <Icon name="link" size={18} class="widget-icon" />
    </div>

    {#if !hasLinks}
      <div class="links-empty">
        <Icon name="link" size={20} />
        <span>No links configured</span>
      </div>
    {:else}
      <div class="links-groups">
        {#each data.groups as group (group.label)}
          <div class="links-group">
            <span class="links-group-label">{group.label}</span>
            <ul class="links-list">
              {#each group.links.slice(0, 5) as link (link.url)}
                <li class="links-item">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" class="links-anchor">
                    <span class="links-name">{link.title}</span>
                    <span class="links-url">{link.url}</span>
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="links-l">
    <div class="widget-header">
      <span class="widget-category-label">LINKS</span>
      <Icon name="link" size={18} class="widget-icon" />
    </div>

    {#if !hasLinks}
      <div class="links-empty">
        <Icon name="link" size={20} />
        <span>No links configured</span>
      </div>
    {:else}
      <div class="links-groups">
        {#each data.groups as group (group.label)}
          <div class="links-group">
            <span class="links-group-label">{group.label}</span>
            <ul class="links-list">
              {#each group.links as link (link.url)}
                <li class="links-item">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" class="links-anchor">
                    <span class="links-name">{link.title}</span>
                    <span class="links-url">{link.url}</span>
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ── S size ─────────────────────────────────────────── */
  .links-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    padding: var(--space-4);
    gap: var(--space-1);
  }

  .links-s-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
  }

  .links-s-unit {
    font-size: 16px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  .links-s-empty {
    font-size: 14px;
    color: var(--color-outline);
  }

  /* ── M/L/XL shared ──────────────────────────────────── */
  .links-m,
  .links-l {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    gap: var(--space-4);
  }

  /* ── Empty state ────────────────────────────────────── */
  .links-empty {
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

  /* ── Groups ─────────────────────────────────────────── */
  .links-groups {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .links-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .links-group-label {
    font-size: var(--font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-outline);
    padding-bottom: 2px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
  }

  .links-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .links-item {
    display: flex;
    align-items: center;
  }

  .links-anchor {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    padding: 4px 0;
    min-width: 0;
  }

  .links-name {
    font-size: 13px;
    color: var(--color-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .links-anchor:hover .links-name {
    color: var(--color-primary-fixed);
    text-decoration: underline;
  }

  .links-url {
    font-size: 11px;
    color: var(--color-outline);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>