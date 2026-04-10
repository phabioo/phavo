<script lang="ts">
interface Props {
  value: number;
  color?: 'accent' | 'danger' | 'warning';
}

let { value, color = 'accent' }: Props = $props();

const clamped = $derived(Math.min(100, Math.max(0, value)));
</script>

<div class="w-full h-1.5 bg-hover rounded-full overflow-hidden">
  <div
    class="h-full rounded-full transition-[width] duration-300 ease-out
      {color === 'danger' ? 'bg-error' : color === 'warning' ? 'bg-primary-fixed' : 'bg-accent'}"
    style:width="{clamped}%"
  ></div>
</div>
