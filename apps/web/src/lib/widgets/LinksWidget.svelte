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

<div class="links-widget">
  {#if !hasLinks}
    <div class="empty">
      <Icon name="bookmark" size={20} />
      <span>No links yet</span>
    </div>
  {:else if size === 'S'}
    <div class="s-row">
      <Icon name="bookmark" size={16} class="text-accent" />
      <span class="metric-value mono">{totalLinks}</span>
      <span class="s-label">links</span>
    </div>
  {:else}
    {#each data.groups as group (group.label)}
      <div class="link-group">
        <span class="group-label">{group.label}</span>
        <ul class="links-list">
          {#each group.links.slice(0, size === 'M' ? 5 : undefined) as link (link.url)}
            <li class="link-item">
              <Icon name={link.icon ?? 'link'} size={14} />
              <a href={link.url} target="_blank" rel="noopener noreferrer" class="link-anchor">
                {link.title}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  {/if}
</div>

<style>
  .links-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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

  .link-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .group-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    padding-bottom: 2px;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .links-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .link-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .link-anchor {
    font-size: 13px;
    color: var(--color-text-primary);
    text-decoration: none;
    padding: 4px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .link-anchor:hover {
    color: var(--color-accent-text);
    text-decoration: underline;
  }
</style>