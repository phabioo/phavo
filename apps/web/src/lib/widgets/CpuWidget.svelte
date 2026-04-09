<script lang="ts">
  import type { CpuMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';

  interface Props {
    data: CpuMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const coreSegments = $derived(
    Array.from({ length: data?.cores?.length ?? 8 }, (_, i) => {
      const load = data?.usage ?? 0;
      const count = data?.cores?.length ?? 8;
      const threshold = (i / count) * 100;
      return threshold < load ? 1 : threshold < load + 20 ? 0.4 : 0.08;
    }),
  );
</script>

{#if size === 'S'}
  <div class="cpu-s">
    <span class="widget-category-label">CPU</span>
    <span class="cpu-value-s hero-glow">{Math.round(data.usage)}<span class="cpu-unit-s">%</span></span>
  </div>
{:else if size === 'M'}
  <div class="cpu-m">
    <div class="widget-header">
      <span class="widget-category-label">PROCESSOR UNIT</span>
      <Icon name="cpu" size={18} class="widget-icon" />
    </div>

    <div class="cpu-hero">
      <span class="hero-number hero-glow">{Math.round(data.usage)}<span class="hero-unit">%</span></span>
    </div>

    <div class="cpu-footer">
      <span class="widget-meta-label">LOAD DISTRIBUTION</span>
      <div class="cpu-bars">
        {#each coreSegments as seg}
          <div class="cpu-bar" style="opacity: {seg}"></div>
        {/each}
      </div>
      <span class="widget-meta-text">{data.cores.length} Cores active · {data.speed.toFixed(1)} GHz Peak</span>
    </div>
  </div>
{:else}
  <div class="cpu-m">
    <div class="widget-header">
      <span class="widget-category-label">PROCESSOR UNIT</span>
      <Icon name="cpu" size={18} class="widget-icon" />
    </div>

    <div class="cpu-hero">
      <span class="hero-number hero-glow">{Math.round(data.usage)}<span class="hero-unit">%</span></span>
    </div>

    <div class="cpu-footer">
      <span class="widget-meta-label">LOAD DISTRIBUTION</span>
      <div class="cpu-bars">
        {#each coreSegments as seg}
          <div class="cpu-bar" style="opacity: {seg}"></div>
        {/each}
      </div>
      <span class="widget-meta-text">{data.cores.length} Cores active · {data.speed.toFixed(1)} GHz Peak</span>
    </div>

    {#if data.cores.length > 0}
      <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-top: 16px;">
        {#each data.cores as coreLoad, i}
          <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
            <span style="font-size: 10px; color: var(--color-on-surface-variant); text-transform: uppercase;">C{i + 1}</span>
            <span style="font-size: 11px; color: var(--color-on-surface); font-weight: 700;">{Math.round(coreLoad)}%</span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .cpu-m {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
  }

  .cpu-hero {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .hero-number {
    font-size: var(--font-size-hero);
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .hero-unit {
    font-size: 30px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
    letter-spacing: 0;
  }

  .cpu-footer {
    display: flex;
    flex-direction: column;
  }

  .cpu-bars {
    display: flex;
    gap: 3px;
    height: 6px;
    margin: var(--space-2) 0;
  }

  .cpu-bar {
    flex: 1;
    background: var(--color-primary-fixed);
    border-radius: 9999px;
  }

  .cpu-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    height: 100%;
    gap: var(--space-1);
  }

  .cpu-value-s {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
  }

  .cpu-unit-s {
    font-size: 16px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }
</style>
