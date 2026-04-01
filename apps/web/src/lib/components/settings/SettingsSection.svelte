<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  tone?: 'default' | 'accent' | 'danger';
  actions?: Snippet;
  footer?: Snippet;
  children: Snippet;
}

let {
  eyebrow,
  title,
  description,
  tone = 'default',
  actions,
  footer,
  children,
}: Props = $props();
</script>

<section class="settings-section settings-section-{tone}">
  <div class="settings-section-header">
    <div class="settings-section-copy">
      {#if eyebrow}
        <span class="settings-section-eyebrow">{eyebrow}</span>
      {/if}
      <h2 class="settings-section-title">{title}</h2>
      {#if description}
        <p class="settings-section-description">{description}</p>
      {/if}
    </div>

    {#if actions}
      <div class="settings-section-actions">
        {@render actions()}
      </div>
    {/if}
  </div>

  <div class="settings-section-body">
    {@render children()}
  </div>

  {#if footer}
    <div class="settings-section-footer">
      {@render footer()}
    </div>
  {/if}
</section>

<style>
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    padding: var(--space-6);
    border-radius: var(--radius-xl);
    border: 1px solid var(--color-border-subtle);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-bg-elevated) 72%, transparent),
        color-mix(in srgb, var(--color-bg-surface) 94%, transparent)
      );
    box-shadow: var(--shadow-sm);
  }

  .settings-section-accent {
    border-color: color-mix(in srgb, var(--color-accent) 26%, var(--color-border-subtle));
    background:
      radial-gradient(
        ellipse 68% 85% at 0% 0%,
        color-mix(in srgb, var(--color-accent-t) 30%, transparent),
        transparent 76%
      ),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-bg-elevated) 72%, transparent),
        color-mix(in srgb, var(--color-bg-surface) 94%, transparent)
      );
  }

  .settings-section-danger {
    border-color: color-mix(in srgb, var(--color-danger) 28%, var(--color-border-subtle));
    background:
      radial-gradient(
        ellipse 68% 85% at 0% 0%,
        color-mix(in srgb, var(--color-danger-subtle) 32%, transparent),
        transparent 78%
      ),
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-bg-elevated) 72%, transparent),
        color-mix(in srgb, var(--color-bg-surface) 94%, transparent)
      );
  }

  .settings-section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .settings-section-copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
    max-width: 64ch;
  }

  .settings-section-eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-accent-text);
  }

  .settings-section-title {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: var(--color-text-primary);
    line-height: 1.08;
  }

  .settings-section-description {
    margin: 0;
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .settings-section-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  .settings-section-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }

  .settings-section-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border-subtle);
  }

  @media (max-width: 639px) {
    .settings-section {
      padding: var(--space-5);
    }

    .settings-section-header,
    .settings-section-footer {
      flex-direction: column;
      align-items: stretch;
    }

    .settings-section-actions {
      justify-content: flex-start;
    }
  }
</style>
