<script lang="ts">
  interface Props {
    size?: number;
    class?: string;
  }
  let { size = 16, class: className = '' }: Props = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 16 16"
  aria-hidden="true"
  class={className}
>
  <path
    d="M8 0 L9 7 L16 8 L9 9 L8 16 L7 9 L0 8 L7 7 Z"
    fill="currentColor"
    style="color: color-mix(in srgb, var(--color-primary-fixed-dim) 20%, transparent)"
  />
</svg>
