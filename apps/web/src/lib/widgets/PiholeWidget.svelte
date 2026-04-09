<script lang="ts">
  import type { PiholeMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';
  import { formatPercentage } from '$lib/utils/format';

  interface Props {
    data: PiholeMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();
</script>

{#if size === 'S'}
  <div class="pi-s">
    <span class="widget-category-label">PI-HOLE</span>
    <span class="pi-s-value hero-glow">
      {formatPercentage(data.percentBlocked, 0)}<span class="pi-s-unit">blocked</span>
    </span>
  </div>
{:else if size === 'M'}
  <div class="pi-m">
    <div class="widget-header">
      <span class="widget-category-label">PI-HOLE</span>
      <Icon name="shield" size={18} class="widget-icon" />
    </div>

    <div class="pi-hero-wrap">
      <span class="pi-hero hero-glow">
        {formatPercentage(data.percentBlocked, 0)}<span class="pi-hero-unit">blocked</span>
      </span>
    </div>

    <div class="pi-footer">
      <div class="pi-meta-row">
        <span class="widget-meta-label">QUERIES TODAY</span>
        <span class="pi-meta-value">{data.totalQueries.toLocaleString()}</span>
      </div>
      <div class="pi-progress-track">
        <div class="pi-progress-fill" style="width: {data.percentBlocked}%"></div>
      </div>
    </div>
  </div>
{:else}
  <div class="pi-l">
    <div class="widget-header">
      <span class="widget-category-label">PI-HOLE</span>
      <Icon name="shield" size={18} class="widget-icon" />
    </div>

    <div class="pi-hero-wrap">
      <span class="pi-hero hero-glow">
        {formatPercentage(data.percentBlocked, 0)}<span class="pi-hero-unit">blocked</span>
      </span>
    </div>

    <div class="pi-footer">
      <div class="pi-meta-row">
        <span class="widget-meta-label">QUERIES TODAY</span>
        <span class="pi-meta-value">{data.totalQueries.toLocaleString()}</span>
      </div>
      <div class="pi-progress-track">
        <div class="pi-progress-fill" style="width: {data.percentBlocked}%"></div>
      </div>

      <div class="pi-extra">
        <div class="pi-extra-row">
          <span class="widget-meta-label">DOMAINS ON BLOCKLIST</span>
          <span class="pi-extra-value">{data.domainsOnBlocklist.toLocaleString()}</span>
        </div>
        <div class="pi-extra-row">
          <span class="widget-meta-label">STATUS</span>
          <span class="pi-status" class:pi-status-active={data.status === 'enabled'} class:pi-status-disabled={data.status === 'disabled'}>
            {data.status === 'enabled' ? 'Active' : 'Disabled'}
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── S size ─────────────────────────────────────────── */
  .pi-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    padding: var(--space-4);
    gap: var(--space-1);
  }

  .pi-s-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
  }

  .pi-s-unit {
    font-size: 16px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
    margin-left: 4px;
  }

  /* ── M/L/XL shared ──────────────────────────────────── */
  .pi-m,
  .pi-l {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    gap: var(--space-4);
  }

  /* ── Hero stat ──────────────────────────────────────── */
  .pi-hero-wrap {
    flex: 1;
    display: flex;
    align-items: flex-start;
  }

  .pi-hero {
    font-size: 56px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .pi-hero-unit {
    font-size: 24px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
    margin-left: 4px;
  }

  /* ── Footer ─────────────────────────────────────────── */
  .pi-footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .pi-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .pi-meta-value {
    font-size: 13px;
    font-weight: 700;
    color: var(--color-on-surface);
    font-family: var(--font-mono);
  }

  /* ── Progress bar ───────────────────────────────────── */
  .pi-progress-track {
    height: 6px;
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    border-radius: 9999px;
    overflow: hidden;
  }

  .pi-progress-fill {
    height: 100%;
    background: linear-gradient(
      to right,
      var(--color-secondary),
      color-mix(in srgb, var(--color-secondary) 60%, var(--color-primary-fixed))
    );
    border-radius: 9999px;
  }

  /* ── Extra (L/XL) ───────────────────────────────────── */
  .pi-extra {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
  }

  .pi-extra-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .pi-extra-value {
    font-size: 13px;
    color: var(--color-on-surface-variant);
    font-family: var(--font-mono);
  }

  .pi-status {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .pi-status-active {
    color: var(--color-secondary);
  }

  .pi-status-disabled {
    color: var(--color-error);
  }
</style>