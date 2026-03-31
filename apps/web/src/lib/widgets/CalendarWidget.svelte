<script lang="ts">
  import type { CalendarMetrics, WidgetSize } from '@phavo/types';
  import { Icon } from '@phavo/ui';

  interface Props {
    data: CalendarMetrics;
    size?: WidgetSize;
  }

  let { data, size = 'M' }: Props = $props();

  const next = $derived(data.events[0] ?? null);

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

<div class="cal-widget">
  {#if !next}
    <div class="empty">
      <Icon name="calendar" size={20} />
      <span>No upcoming events</span>
    </div>
  {:else if size === 'S'}
    <div class="s-row">
      <Icon name="calendar" size={16} class="text-accent" />
      <span class="s-title">{next.title}</span>
    </div>
  {:else}
    <div class="event-list">
      {#each data.events.slice(0, size === 'M' ? 5 : 10) as evt (evt.title + evt.startTime)}
        <div class="event-row">
          <div class="event-dot"></div>
          <div class="event-info">
            <span class="event-title">{evt.title}</span>
            <div class="event-meta">
              <span class="event-time">{fmtDate(evt.startTime)}</span>
              {#if evt.calendarName}
                <span class="event-cal">{evt.calendarName}</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .cal-widget {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) 0;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  .s-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .s-title {
    font-size: 13px;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .event-row {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .event-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-accent);
    flex-shrink: 0;
    margin-top: 4px;
  }

  .event-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .event-title {
    font-size: 13px;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .event-meta {
    display: flex;
    gap: var(--space-2);
    font-size: 11px;
  }

  .event-time {
    color: var(--color-text-muted);
  }

  .event-cal {
    color: var(--color-accent-text);
  }
</style>