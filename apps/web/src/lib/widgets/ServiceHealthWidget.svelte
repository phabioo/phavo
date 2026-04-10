<script lang="ts">
  import type { ServiceHealthMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';

  interface Props {
    data: ServiceHealthMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const up = $derived(data.services.filter(s => s.status === 'up').length);
  const total = $derived(data.services.length);
  const down = $derived(data.services.filter(s => s.status === 'down' || s.status === 'timeout').length);
  const upRatio = $derived(total > 0 ? (up / total) * 100 : 0);
</script>

{#if size === 'S'}
  <div class="sh-s">
    <span class="widget-category-label">SERVICES</span>
    <span class="sh-s-value hero-glow">
      {up}<span class="sh-s-unit">/{total} UP</span>
    </span>
  </div>
{:else if size === 'M'}
  <div class="sh-m">
    <div class="widget-header">
      <span class="widget-category-label">SERVICES</span>
      <Icon name="shield" size={18} class="widget-icon" />
    </div>

    <div class="sh-hero-wrap">
      <span class="sh-hero hero-glow">
        {up}<span class="sh-hero-unit">/{total}</span>
      </span>
    </div>

    <div class="sh-health">
      <div class="sh-health-track"><div class="sh-health-fill" style:width={`${upRatio}%`}></div></div>
      <div class="sh-health-meta">
        <span>{up} online</span>
        <span>{down} offline</span>
      </div>
    </div>

    <div class="sh-list">
      {#each data.services.slice(0, 6) as svc (svc.name)}
        <div class="sh-row">
          <div class="sh-row-info">
            <span class="sh-status-dot" class:sh-status-up={svc.status === 'up'} class:sh-status-down={svc.status === 'down' || svc.status === 'timeout'}></span>
            <span class="sh-svc-name">{svc.name}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else}
  <div class="sh-l">
    <div class="widget-header">
      <span class="widget-category-label">SERVICES</span>
      <Icon name="shield" size={18} class="widget-icon" />
    </div>

    <div class="sh-hero-wrap">
      <span class="sh-hero hero-glow">
        {up}<span class="sh-hero-unit">/{total}</span>
      </span>
    </div>

    <div class="sh-health">
      <div class="sh-health-track"><div class="sh-health-fill" style:width={`${upRatio}%`}></div></div>
      <div class="sh-health-meta">
        <span>{up} online</span>
        <span>{down} offline</span>
      </div>
    </div>

    <div class="sh-list">
      {#each data.services.slice(0, size === 'XL' ? 12 : 8) as svc (svc.name)}
        <div class="sh-row">
          <div class="sh-row-info">
            <span class="sh-status-dot" class:sh-status-up={svc.status === 'up'} class:sh-status-down={svc.status === 'down' || svc.status === 'timeout'}></span>
            <span class="sh-svc-name">{svc.name}</span>
          </div>
          {#if svc.responseTimeMs != null}
            <span class="sh-latency">{svc.responseTimeMs}ms</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  /* ── S size ─────────────────────────────────────────── */
  .sh-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    padding: var(--space-4);
    gap: var(--space-1);
  }

  .sh-s-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
  }

  .sh-s-unit {
    font-size: 16px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  /* ── M/L/XL shared ──────────────────────────────────── */
  .sh-m,
  .sh-l {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    gap: var(--space-4);
  }

  /* ── Hero stat ──────────────────────────────────────── */
  .sh-hero-wrap {
    flex: 1;
    display: flex;
    align-items: flex-start;
  }

  .sh-hero {
    font-size: 72px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .sh-hero-unit {
    font-size: 30px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  /* ── Service list ───────────────────────────────────── */
  .sh-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: 0;
    overflow: hidden;
  }

  .sh-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-surface-high) 45%, transparent);
  }

  .sh-row-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .sh-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--color-outline);
  }

  .sh-status-up {
    background: var(--color-secondary);
  }

  .sh-status-down {
    background: var(--color-error);
  }

  .sh-svc-name {
    font-size: 13px;
    color: var(--color-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sh-latency {
    font-size: 12px;
    color: var(--color-outline);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }

  .sh-health {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .sh-health-track {
    height: 6px;
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--color-on-surface) 7%, transparent);
    overflow: hidden;
  }

  .sh-health-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--color-secondary), var(--color-secondary-fixed));
    transition: width var(--motion-component);
  }

  .sh-health-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--color-on-surface-variant);
  }
</style>