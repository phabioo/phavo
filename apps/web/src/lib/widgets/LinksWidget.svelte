<script lang="ts">
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
  }

  let { data }: Props = $props();

  const hasLinks = $derived(data.groups.length > 0);
</script>

<div class="links-widget">
  {#if !hasLinks}
    <div class="empty-state">
      <span class="empty-icon" aria-hidden="true">🔖</span>
      <p class="empty-message">No links yet — add bookmarks in Settings.</p>
    </div>
  {:else}
    {#each data.groups as group (group.label)}
      <div class="link-group">
        <span class="group-label">{group.label}</span>
        <ul class="links-list">
          {#each group.links as link (link.url)}
            <li class="link-item">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                class="link-anchor"
              >
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

  /* --- Grouped links --- */
  .link-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .group-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    padding-bottom: 2px;
    border-bottom: 1px solid var(--color-border);
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
  }

  .link-anchor {
    font-size: 0.875rem;
    color: var(--color-text);
    text-decoration: none;
    padding: 4px 0;
    transition: color 0.15s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .link-anchor:hover {
    color: var(--color-accent);
    text-decoration: underline;
  }
</style>
