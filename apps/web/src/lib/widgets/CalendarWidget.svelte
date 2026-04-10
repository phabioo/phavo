<script lang="ts">
  import type { CalendarMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';

  interface Props {
    data: CalendarMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const next = $derived(data.events[0] ?? null);
  const total = $derived(data.events.length);

  function fmtDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today ${time}`;
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    if (d.toDateString() === tom.toDateString()) return `Tomorrow ${time}`;
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ` ${time}`;
  }
</script>

{#if size === 'S'}
  {#if !next}
    <div class="cal-s">
      <span class="widget-category-label">CALENDAR</span>
      <span class="cal-s-empty">No upcoming events</span>
    </div>
  {:else}
    <div class="cal-s">
      <span class="widget-category-label">CALENDAR</span>
      <span class="cal-s-title hero-glow">{next.title}</span>
    </div>
  {/if}
{:else if size === 'M'}
  <div class="cal-m">
    <div class="widget-header">
      <span class="widget-category-label">CALENDAR</span>
      <Icon name="calendar" size={18} class="widget-icon" />
    </div>

    {#if !next}
      <div class="cal-empty">
        <Icon name="calendar" size={20} />
        <span>No upcoming events</span>
      </div>
    {:else}
      <div class="cal-next">
        <span class="cal-next-title hero-glow">{next.title}</span>
        <span class="cal-next-time">{fmtDate(next.startTime)}</span>
      </div>

      <div class="cal-meta">
        <span>{total} upcoming</span>
        <span>{next.calendarName}</span>
      </div>

      {#if data.events.length > 1}
        <div class="cal-list">
          {#each data.events.slice(1, 4) as evt (evt.title + evt.startTime)}
            <div class="cal-row">
              <div class="cal-dot"></div>
              <div class="cal-row-info">
                <span class="cal-event-title">{evt.title}</span>
                <span class="cal-event-time">{fmtDate(evt.startTime)}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
{:else}
  <div class="cal-l">
    <div class="widget-header">
      <span class="widget-category-label">CALENDAR</span>
      <Icon name="calendar" size={18} class="widget-icon" />
    </div>

    {#if !next}
      <div class="cal-empty">
        <Icon name="calendar" size={20} />
        <span>No upcoming events</span>
      </div>
    {:else}
      <div class="cal-next">
        <span class="cal-next-title hero-glow">{next.title}</span>
        <span class="cal-next-time">{fmtDate(next.startTime)}</span>
      </div>

      <div class="cal-meta">
        <span>{total} upcoming</span>
        <span>{next.calendarName}</span>
      </div>

      {#if data.events.length > 1}
        <div class="cal-list">
          {#each data.events.slice(1, size === 'XL' ? 9 : 8) as evt (evt.title + evt.startTime)}
            <div class="cal-row">
              <div class="cal-dot"></div>
              <div class="cal-row-info">
                <span class="cal-event-title">{evt.title}</span>
                <span class="cal-event-time">{fmtDate(evt.startTime)}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
  /* ── S size ─────────────────────────────────────────── */
  .cal-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    padding: var(--space-4);
    gap: var(--space-1);
  }

  .cal-s-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cal-s-empty {
    font-size: 14px;
    color: var(--color-outline);
  }

  /* ── M/L/XL shared ──────────────────────────────────── */
  .cal-m,
  .cal-l {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    gap: var(--space-4);
  }

  /* ── Next event (prominent) ─────────────────────────── */
  .cal-next {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .cal-next-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-primary-fixed);
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .cal-next-time {
    font-size: 14px;
    color: var(--color-secondary);
    font-family: var(--font-mono);
  }

  /* ── Empty state ────────────────────────────────────── */
  .cal-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
    color: var(--color-outline);
    font-size: 13px;
    flex: 1;
    justify-content: center;
  }

  /* ── Event list ─────────────────────────────────────── */
  .cal-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-height: 0;
    overflow: hidden;
  }

  .cal-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-surface-high) 45%, transparent);
  }

  .cal-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-primary-fixed);
    flex-shrink: 0;
    margin-top: 4px;
  }

  .cal-row-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cal-event-title {
    font-size: 13px;
    color: var(--color-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cal-event-time {
    font-size: 11px;
    color: var(--color-secondary);
  }

  .cal-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    font-size: 11px;
    font-family: var(--font-mono);
    color: var(--color-on-surface-variant);
  }
</style>