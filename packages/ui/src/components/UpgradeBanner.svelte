<script lang="ts">
interface Props {
  feature: string;
  price?: string;
}

let { feature, price = '€8.99' }: Props = $props();
</script>

<div class="upgrade-banner">
  <div class="upgrade-content">
    <span class="upgrade-icon">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1L10 6H15L11 9.5L12.5 15L8 11.5L3.5 15L5 9.5L1 6H6L8 1Z" fill="currentColor"/>
      </svg>
    </span>
    <p class="upgrade-text">
      Upgrade to Standard to unlock <strong>{feature}</strong> — {price} one-time.
    </p>
  </div>
</div>

<style>
  .upgrade-banner {
    background: var(--color-accent-subtle);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }

  .upgrade-content {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .upgrade-icon {
    color: var(--color-accent-text);
    flex-shrink: 0;
    display: flex;
  }

  .upgrade-text {
    font-size: 14px;
    color: var(--color-accent-text);
  }

  .upgrade-text strong {
    font-weight: 600;
  }
</style>
