<script lang="ts">
  /**
   * Icon abstraction — checks active theme's icons/<name>.svg first,
   * falls back to Lucide. Theme override is a stub for now (v1.0).
   *
   * Usage: <Icon name="cpu" /> or <Icon name="panel-left" size={24} />
   * Names use kebab-case (Lucide convention), auto-mapped to PascalCase.
   */
  import * as lucideIcons from 'lucide-svelte';
  import type { Component } from 'svelte';

  interface Props {
    name: string;
    size?: number;
    class?: string;
    strokeWidth?: number;
  }

  let {
    name,
    size = 20,
    class: cls = '',
    strokeWidth = 2,
  }: Props = $props();

  /** Convert kebab-case "panel-left" → PascalCase "PanelLeft" */
  function toPascalCase(str: string): string {
    return str
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
  }

  const iconComponent: Component | undefined = $derived.by(() => {
    const pascal = toPascalCase(name);
    const all = lucideIcons as unknown as Record<string, Component>;
    return all[pascal] ?? all['CircleHelp'];
  });
</script>

{#if iconComponent}
  {@const Comp = iconComponent}
  <Comp
    {size}
    class={cls}
    {strokeWidth}
  />
{/if}
