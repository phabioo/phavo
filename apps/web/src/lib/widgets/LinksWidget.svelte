<script lang="ts">
  interface LinkItem {
    id?: string;
    label: string;
    url: string;
    category?: string;
  }

  interface Props {
    data: LinkItem[];
  }

  let { data }: Props = $props();

  const hasLinks = $derived(data.length > 0);

  // Group links by category for nicer display
  const grouped = $derived(() => {
    if (!hasLinks) return new Map<string, LinkItem[]>();
    const map = new Map<string, LinkItem[]>();
    for (const link of data) {
      const cat = link.category ?? 'Uncategorised';
      const existing = map.get(cat) ?? [];
      existing.push(link);
      map.set(cat, existing);
    }
    return map;
  });
</script>

<div class="links-widget">
  {#if !hasLinks}
    <div class="empty-state">
      <span class="empty-icon" aria-hidden="true">🔖</span>
      <p class="empty-message">No links yet — add bookmarks in Settings.</p>
    </div>
  {:else}
    {#each [...grouped().entries()] as [category, links] (category)}
      <div class="link-group">
        <span class="group-label">{category}</span>
        <ul class="links-list">
          {#each links as link (link.url)}
            <li class="link-item">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                class="link-anchor"
              >
                {link.label}
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
