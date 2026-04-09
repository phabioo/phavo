<script lang="ts">
  // ─────────────────────────────────────────────────────────────
  // PHAVO Widget Template
  // Copy this file and replace all occurrences of:
  //   MyWidget      → YourWidgetName (e.g. SpeedtestWidget)
  //   MY_WIDGET     → YOUR_WIDGET    (e.g. SPEEDTEST)
  //   my-widget     → your-widget    (e.g. speedtest)
  //   my-icon       → your-icon      (e.g. gauge)
  //   MyDataType    → YourDataType   (e.g. SpeedtestData)
  //
  // See docs/widget-guide.md for the full specification.
  // ─────────────────────────────────────────────────────────────

  import { Icon } from '@phavo/ui';

  // ── Types ──────────────────────────────────────────────────────
  // Define the shape of data your widget receives from the store.
  // This comes from your Hono API handler's response.data field.
  interface MyDataType {
    value: number;
    // add your fields here
  }

  interface Props {
    data: MyDataType | null;
    size: 'S' | 'M' | 'L' | 'XL';
  }

  let { data, size }: Props = $props();

  // ── Derived values ─────────────────────────────────────────────
  // Transform raw data into display values.
  // Always provide fallbacks for null data.
  const primaryValue = $derived(data?.value ?? 0);
  const displayValue = $derived(primaryValue.toFixed(1));
</script>

<!-- ── S — Compact: category label + single stat ──────────────── -->
{#if size === 'S'}
<div class="my-widget-s">
  <span class="widget-category-label">MY WIDGET</span>
  <span class="my-hero-s hero-glow">
    {displayValue}<span class="my-unit-s">unit</span>
  </span>
</div>

<!-- ── M — Standard: header + hero stat + one secondary element ── -->
{:else if size === 'M'}
<div class="my-widget-m">
  <div class="widget-header">
    <span class="widget-category-label">MY WIDGET</span>
    <Icon name="my-icon" size={18} class="widget-icon" />
  </div>

  <div class="my-hero-wrap">
    <span class="my-hero hero-glow">
      {displayValue}<span class="my-unit">unit</span>
    </span>
  </div>

  <!-- Secondary element: progress bar, subtitle, or small stat -->
  <div class="my-secondary">
    <span class="widget-meta-label">SECONDARY LABEL</span>
    <div class="my-progress-track">
      <div class="my-progress-fill" style="width: {primaryValue}%"></div>
    </div>
  </div>
</div>

<!-- ── L — Extended: header + hero stat + chart or list ─────────── -->
{:else if size === 'L'}
<div class="my-widget-l">
  <div class="widget-header">
    <span class="widget-category-label">MY WIDGET</span>
    <Icon name="my-icon" size={18} class="widget-icon" />
  </div>

  <div class="my-hero-wrap">
    <span class="my-hero hero-glow">
      {displayValue}<span class="my-unit">unit</span>
    </span>
  </div>

  <!-- L adds: chart, list, or expanded detail -->
  <div class="my-secondary">
    <span class="widget-meta-label">SECONDARY LABEL</span>
    <div class="my-progress-track">
      <div class="my-progress-fill" style="width: {primaryValue}%"></div>
    </div>
  </div>

  <!-- L-specific extra content -->
  <div class="my-detail">
    <span class="widget-meta-text">Additional detail here</span>
  </div>
</div>

<!-- ── XL — Full story: same as L plus more ─────────────────────── -->
{:else}
<div class="my-widget-xl">
  <div class="widget-header">
    <span class="widget-category-label">MY WIDGET</span>
    <Icon name="my-icon" size={18} class="widget-icon" />
  </div>

  <div class="my-hero-wrap">
    <span class="my-hero hero-glow">
      {displayValue}<span class="my-unit">unit</span>
    </span>
  </div>

  <div class="my-secondary">
    <span class="widget-meta-label">SECONDARY LABEL</span>
    <div class="my-progress-track">
      <div class="my-progress-fill" style="width: {primaryValue}%"></div>
    </div>
  </div>

  <div class="my-detail">
    <span class="widget-meta-text">Additional detail here</span>
  </div>

  <!-- XL-specific extra content — more rows, history, breakdown -->
  <div class="my-xl-extra">
    <span class="widget-meta-text">XL-only content</span>
  </div>
</div>
{/if}

<style>
  /* ── CRITICAL: No overflow:hidden on widget wrappers ──────────
     Only add overflow:hidden to specific chart/bar containers.  */

  /* ── S size ──────────────────────────────────────────────────── */
  .my-widget-s {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: 100%;
    padding: var(--space-4);
    gap: var(--space-1);
  }

  .my-hero-s {
    font-size: 32px;
    font-weight: 700;
    color: var(--color-primary-fixed);  /* always gold */
    letter-spacing: -0.02em;
  }

  .my-unit-s {
    font-size: 16px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  /* ── M/L/XL shared ───────────────────────────────────────────── */
  .my-widget-m,
  .my-widget-l,
  .my-widget-xl {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    padding: var(--space-8);
    gap: var(--space-4);
  }

  /* ── Hero stat ───────────────────────────────────────────────── */
  .my-hero-wrap {
    flex: 1;
    display: flex;
    align-items: flex-start;
  }

  .my-hero {
    font-size: 72px;
    font-weight: 700;
    color: var(--color-primary-fixed);  /* always gold */
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .my-unit {
    font-size: 30px;
    font-weight: 300;
    color: var(--color-on-surface-variant);
  }

  /* ── Secondary section ───────────────────────────────────────── */
  .my-secondary {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  /* ── Progress bar (data visualization — always teal) ─────────── */
  .my-progress-track {
    height: 6px;
    background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    border-radius: 9999px;
    overflow: hidden;  /* ← overflow:hidden only here, on the track */
  }

  .my-progress-fill {
    height: 100%;
    background: linear-gradient(
      to right,
      var(--color-secondary),
      color-mix(in srgb, var(--color-secondary) 60%, var(--color-primary-fixed))
    );
    border-radius: 9999px;
  }

  /* ── Detail sections ─────────────────────────────────────────── */
  .my-detail {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .my-xl-extra {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
</style>
