<script lang="ts">
  import { onMount } from 'svelte';
  import type { NetworkMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';
  import { formatBytes, formatSpeed } from '$lib/utils/format';

  interface Props {
    data: NetworkMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  // Track the max seen speed for a mini spark-like visual proportion
  let maxSpeed = $state(1);
  
  onMount(() => {
    $effect.root(() => {
      $effect(() => {
        const peak = Math.max(data.uploadSpeed, data.downloadSpeed, 1);
        if (peak > maxSpeed) maxSpeed = peak;
      });
    });
  });

  const downPct = $derived(Math.min(100, (data.downloadSpeed / maxSpeed) * 100));
  const upPct   = $derived(Math.min(100, (data.uploadSpeed   / maxSpeed) * 100));
</script>

<div class="network-widget">
  {#if size === 'S'}
    <div class="s-row">
      <Icon name="globe" size={16} class="text-accent" />
      <span class="speed-value mono">{formatSpeed(data.downloadSpeed)}</span>
    </div>
  {:else}
    <div class="speed-blocks">
      <div class="speed-block">
        <div class="speed-direction">
          <span class="arrow down">↓</span>
          <span class="speed-label">Download</span>
        </div>
        <span class="speed-value mono">{formatSpeed(data.downloadSpeed)}</span>
      </div>

      <div class="speed-divider"></div>

      <div class="speed-block">
        <div class="speed-direction">
          <span class="arrow up">↑</span>
          <span class="speed-label">Upload</span>
        </div>
        <span class="speed-value mono">{formatSpeed(data.uploadSpeed)}</span>
      </div>
    </div>

    <div class="online-row">
      <span class="online-dot"></span>
      <span class="online-label">Online</span>
    </div>

    {#if (size === 'L' || size === 'XL')}
      <div class="totals-row">
        <div class="total-stat">
          <span class="total-label">Total Received</span>
          <span class="total-value mono">{formatBytes(data.totalReceived)}</span>
        </div>
        <div class="total-stat">
          <span class="total-label">Total Sent</span>
          <span class="total-value mono">{formatBytes(data.totalSent)}</span>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .network-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .s-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .speed-blocks {
    display: flex;
    gap: var(--space-4);
    align-items: stretch;
  }

  .speed-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .speed-direction {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .arrow {
    font-size: 14px;
    line-height: 1;
    font-weight: 700;
  }

  .down { color: var(--color-accent); }
  .up   { color: var(--color-accent-text); }

  .speed-label {
    font-size: 11px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .speed-value {
    font-size: 22px;
    font-weight: 700;
    color: var(--color-text-primary);
    line-height: 1;
  }

  .s-row .speed-value {
    font-size: 20px;
  }

  .speed-divider {
    width: 1px;
    background: var(--color-border-subtle);
    align-self: stretch;
  }

  .online-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .online-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-success);
  }

  .online-label {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .totals-row {
    display: flex;
    justify-content: space-between;
    padding-top: var(--space-2);
    border-top: 1px solid var(--color-border-subtle);
  }

  .total-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .total-label {
    font-size: 10px;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  .total-value {
    font-size: 13px;
    color: var(--color-text-secondary);
  }
</style>
