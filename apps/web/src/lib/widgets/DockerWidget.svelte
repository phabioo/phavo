<script lang="ts">
  import type { DockerMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';
  import { formatBytes } from '$lib/utils/format';

  interface Props {
    data: DockerMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const running = $derived(data.containers.filter(c => c.status === 'running').length);
  const total = $derived(data.containers.length);
  const stopped = $derived(data.containers.filter(c => c.status === 'stopped').length);
  const paused = $derived(data.containers.filter(c => c.status === 'paused').length);
  const runningRatio = $derived(total > 0 ? (running / total) * 100 : 0);
</script>

{#if size === 'S'}
  <div class="docker-s">
    <span class="widget-category-label">DOCKER</span>
    <span class="docker-s-value hero-glow">
      {running}/{total}
    </span>
  </div>
{:else if size === 'M'}
  <div class="docker-m">
    <div class="widget-header">
      <span class="widget-category-label">DOCKER</span>
      <Icon name="container" size={18} class="widget-icon" />
    </div>

    <div class="docker-hero-wrap">
      <span class="docker-hero hero-glow">
        {running}<span class="docker-hero-unit">/{total}</span>
      </span>
    </div>

    <div class="docker-health">
      <div class="docker-health-track"><div class="docker-health-fill" style:width={`${runningRatio}%`}></div></div>
      <div class="docker-health-meta">
        <span>{running} running</span>
        <span>{stopped} stopped</span>
      </div>
    </div>

    {#if data.containers.length === 0}
      <div class="docker-empty">
        <Icon name="container" size={20} />
        <span>No containers</span>
      </div>
    {:else}
      <div class="docker-list">
        {#each data.containers.slice(0, 5) as ctr (ctr.name)}
          <div class="docker-row">
            <div class="docker-row-info">
              <span class="docker-status-dot" class:docker-status-running={ctr.status === 'running'} class:docker-status-paused={ctr.status === 'paused'} class:docker-status-stopped={ctr.status === 'stopped'}></span>
              <span class="docker-ctr-name">{ctr.name}</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <div class="docker-l">
    <div class="widget-header">
      <span class="widget-category-label">DOCKER</span>
      <Icon name="container" size={18} class="widget-icon" />
    </div>

    <div class="docker-hero-wrap">
      <span class="docker-hero hero-glow">
        {running}<span class="docker-hero-unit">/{total}</span>
      </span>
    </div>

    <div class="docker-health">
      <div class="docker-health-track"><div class="docker-health-fill" style:width={`${runningRatio}%`}></div></div>
      <div class="docker-health-meta">
        <span>{running} running</span>
        <span>{paused} paused</span>
        <span>{stopped} stopped</span>
      </div>
    </div>

    {#if data.containers.length === 0}
      <div class="docker-empty">
        <Icon name="container" size={20} />
        <span>No containers</span>
      </div>
    {:else}
      <div class="docker-list">
        {#each data.containers.slice(0, size === 'XL' ? 10 : 8) as ctr (ctr.name)}
          <div class="docker-row">
            <div class="docker-row-info">
              <span class="docker-status-dot" class:docker-status-running={ctr.status === 'running'} class:docker-status-paused={ctr.status === 'paused'} class:docker-status-stopped={ctr.status === 'stopped'}></span>
              <span class="docker-ctr-name">{ctr.name}</span>
            </div>
            {#if ctr.cpuPercent != null}
              <div class="docker-ctr-stats">
                <span class="docker-ctr-stat">{ctr.cpuPercent.toFixed(1)}%</span>
                <span class="docker-ctr-stat">{formatBytes(ctr.memoryUsed ?? 0)}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  /* ── S size ─────────────────────────────────────────── */
  .docker-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    padding: var(--space-4);
    gap: var(--space-1);
  }

  .docker-s-value {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
  }

  /* ── M/L/XL shared ──────────────────────────────────── */
  .docker-m,
  .docker-l {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    gap: var(--space-4);
  }

  /* ── Hero stat ──────────────────────────────────────── */
  .docker-hero-wrap {
    flex: 1;
    display: flex;
    align-items: flex-start;
  }

  .docker-hero {
    font-size: 72px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .docker-hero-unit {
    font-size: 30px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  /* ── Container list ─────────────────────────────────── */
  .docker-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
    color: var(--color-outline);
    font-size: 13px;
  }

  .docker-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: 0;
    overflow: hidden;
  }

  .docker-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-surface-high) 45%, transparent);
  }

  .docker-row-info {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .docker-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--color-outline);
  }

  .docker-status-running {
    background: var(--color-secondary);
  }

  .docker-status-stopped {
    background: var(--color-error);
  }

  .docker-status-paused {
    background: var(--color-outline);
  }

  .docker-ctr-name {
    font-size: 13px;
    color: var(--color-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .docker-ctr-stats {
    display: flex;
    gap: var(--space-3);
    flex-shrink: 0;
  }

  .docker-ctr-stat {
    font-size: 12px;
    color: var(--color-outline);
    font-family: var(--font-mono);
  }

  .docker-health {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .docker-health-track {
    height: 6px;
    border-radius: var(--radius-full);
    background: color-mix(in srgb, var(--color-on-surface) 7%, transparent);
    overflow: hidden;
  }

  .docker-health-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--color-secondary), var(--color-secondary-fixed));
    transition: width var(--motion-component);
  }

  .docker-health-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--color-on-surface-variant);
  }
</style>