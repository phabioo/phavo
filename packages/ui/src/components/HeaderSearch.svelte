<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';

  export interface SearchEntry {
    id: string;
    label: string;
    subtitle?: string;
    category: 'widget' | 'settings' | 'tab' | 'action' | 'notification';
    icon?: string;
    action: () => void;
  }

  export interface AiProviders {
    ollama: boolean;
    openai: boolean;
    anthropic: boolean;
  }

  interface Props {
    searchIndex?: SearchEntry[];
    searchEngineUrl?: string | undefined;
    aiProviders?: AiProviders | undefined;
    tier?: 'free' | 'standard' | 'pro' | 'local';
    onAction?: ((entry: SearchEntry) => void) | undefined;
    onAiChat?:
      | ((
          provider: 'ollama' | 'openai' | 'anthropic',
          query: string,
        ) => Promise<string>)
      | undefined;
  }

  let {
    searchIndex = [],
    searchEngineUrl = 'https://duckduckgo.com/?q={query}',
    aiProviders = { ollama: false, openai: false, anthropic: false },
    tier = 'free',
    onAction,
    onAiChat,
  }: Props = $props();

  const MAX_RESULTS = 8;
  const PROVIDER_LABELS: Record<'ollama' | 'openai' | 'anthropic', string> = {
    ollama: 'Ollama',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
  };
  const CATEGORY_ICONS: Record<SearchEntry['category'], string> = {
    widget: 'layout-grid',
    settings: 'settings-2',
    tab: 'folder-open',
    action: 'sparkles',
    notification: 'bell',
  };

  let query = $state('');
  let open = $state(false);
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement>();
  let aiResponse = $state<{ provider: string; text: string } | null>(null);
  let aiLoading = $state(false);
  let isMac = $state(false);

  const results = $derived.by(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    return searchIndex
      .filter(
        (entry) =>
          entry.label.toLowerCase().includes(trimmed) ||
          entry.subtitle?.toLowerCase().includes(trimmed),
      )
      .slice(0, MAX_RESULTS);
  });

  const engineName = $derived.by(() => {
    try {
      const host = new URL(searchEngineUrl.replace('{query}', 'test')).hostname;
      const name = host.replace(/^www\./, '').split('.')[0] ?? 'web';
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return 'Web';
    }
  });

  const webSearchEntry = $derived.by(() => {
    const trimmed = query.trim();
    if (!trimmed) return null;

    return {
      id: '__web_search__',
      label: `Search "${trimmed}" on ${engineName}`,
      action: () => {
        window.open(
          searchEngineUrl.replace('{query}', encodeURIComponent(trimmed)),
          '_blank',
          'noopener,noreferrer',
        );
      },
    };
  });

  const aiEntries = $derived.by(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const items: Array<{
      id: string;
      provider: 'ollama' | 'openai' | 'anthropic';
      label: string;
    }> = [];

    for (const provider of ['ollama', 'openai', 'anthropic'] as const) {
      if (aiProviders[provider]) {
        items.push({
          id: `__ai_${provider}__`,
          provider,
          label: `Ask ${PROVIDER_LABELS[provider]} about "${trimmed}"`,
        });
      }
    }

    return items;
  });

  const webSearchIndex = $derived(results.length);
  const aiStartIndex = $derived(results.length + (webSearchEntry ? 1 : 0));
  const totalResults = $derived(
    results.length + (webSearchEntry ? 1 : 0) + (tier !== 'free' ? aiEntries.length : 0),
  );

  function clickOutside(node: HTMLElement, callback: () => void) {
    function handle(event: MouseEvent) {
      if (!node.contains(event.target as Node)) callback();
    }

    document.addEventListener('mousedown', handle);
    return {
      destroy() {
        document.removeEventListener('mousedown', handle);
      },
    };
  }

  function dismiss() {
    query = '';
    open = false;
    aiResponse = null;
    inputEl?.blur();
  }

  function clearQuery(event?: MouseEvent) {
    event?.stopPropagation();
    query = '';
    aiResponse = null;
    selectedIndex = 0;
    inputEl?.focus();
  }

  function handleInput() {
    selectedIndex = 0;
    aiResponse = null;
  }

  function getEntryIcon(entry: SearchEntry): string {
    return entry.icon ?? CATEGORY_ICONS[entry.category];
  }

  function executeSelected() {
    if (totalResults === 0) return;

    if (selectedIndex < results.length) {
      const entry = results[selectedIndex];
      if (entry) {
        entry.action();
        onAction?.(entry);
        dismiss();
      }
      return;
    }

    if (webSearchEntry && selectedIndex === webSearchIndex) {
      webSearchEntry.action();
      dismiss();
      return;
    }

    const aiEntry = aiEntries[selectedIndex - aiStartIndex];
    if (aiEntry) {
      void askAi(aiEntry.provider);
    }
  }

  async function askAi(provider: 'ollama' | 'openai' | 'anthropic') {
    if (!onAiChat || !query.trim()) return;

    aiLoading = true;
    const providerLabel = PROVIDER_LABELS[provider];
    aiResponse = { provider: providerLabel, text: '' };

    try {
      const text = await onAiChat(provider, query.trim());
      aiResponse = { provider: providerLabel, text };
    } catch {
      aiResponse = { provider: providerLabel, text: 'Failed to get a response.' };
    } finally {
      aiLoading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (totalResults > 0) {
        selectedIndex = Math.min(selectedIndex + 1, totalResults - 1);
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (totalResults > 0) {
        selectedIndex = Math.max(selectedIndex - 1, 0);
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      executeSelected();
      return;
    }

    if (event.key === 'Escape') {
      dismiss();
    }
  }

  function handleGlobalKey(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();

      if (open) {
        dismiss();
      } else {
        open = true;
        requestAnimationFrame(() => inputEl?.focus());
      }
    }
  }

  onMount(() => {
    isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  });
</script>

<svelte:window onkeydown={handleGlobalKey} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="hs-wrap" use:clickOutside={() => (open = false)}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="hs-bar"
    class:open={open}
    onclick={() => {
      open = true;
      requestAnimationFrame(() => inputEl?.focus());
    }}
  >
    <span class="hs-leading" aria-hidden="true">
      <Icon name="search" size={15} />
    </span>

    <input
      bind:this={inputEl}
      bind:value={query}
      class="hs-input"
      placeholder="Search widgets, pages, or ask AI"
      onfocus={() => (open = true)}
      oninput={handleInput}
      onkeydown={handleKeydown}
      autocomplete="off"
      spellcheck="false"
      aria-label="Search or ask"
    />

    {#if query}
      <button class="hs-clear" aria-label="Clear search" onclick={clearQuery}>
        <Icon name="x" size={12} />
      </button>
    {:else}
      <kbd class="hs-kbd">{isMac ? 'Cmd+K' : 'Ctrl+K'}</kbd>
    {/if}
  </div>

  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="hs-dropdown" onmousedown={(event) => event.preventDefault()}>
      {#if !query.trim()}
        <div class="hs-hint">
          <span class="hs-hint-title">Command search</span>
          <p class="hs-hint-copy">Jump to pages, settings, widgets, or ask an enabled AI provider.</p>
        </div>
      {:else}
        {#if results.length > 0}
          <div class="hs-group-label">Dashboard</div>
          {#each results as entry, index}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="hs-item"
              class:hs-item--active={selectedIndex === index}
              onmouseenter={() => (selectedIndex = index)}
              onmousedown={() => {
                entry.action();
                onAction?.(entry);
                dismiss();
              }}
            >
              <span class="hs-item-icon">
                <Icon name={getEntryIcon(entry)} size={14} />
              </span>
              <span class="hs-item-copy">
                <span class="hs-item-label">{entry.label}</span>
                {#if entry.subtitle}
                  <span class="hs-item-sub">{entry.subtitle}</span>
                {/if}
              </span>
            </div>
          {/each}
        {/if}

        {#if webSearchEntry}
          <div class="hs-group-label">Web search</div>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="hs-item"
            class:hs-item--active={selectedIndex === webSearchIndex}
            onmouseenter={() => (selectedIndex = webSearchIndex)}
            onmousedown={() => {
              webSearchEntry.action();
              dismiss();
            }}
          >
            <span class="hs-item-icon">
              <Icon name="globe-2" size={14} />
            </span>
            <span class="hs-item-copy">
              <span class="hs-item-label">{webSearchEntry.label}</span>
            </span>
          </div>
        {/if}

        {#if tier !== 'free' && aiEntries.length > 0}
          <div class="hs-group-label">Ask AI</div>
          {#each aiEntries as aiEntry, index}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="hs-item"
              class:hs-item--active={selectedIndex === aiStartIndex + index}
              onmouseenter={() => (selectedIndex = aiStartIndex + index)}
              onmousedown={() => void askAi(aiEntry.provider)}
            >
              <span class="hs-item-icon">
                <Icon name="sparkles" size={14} />
              </span>
              <span class="hs-item-copy">
                <span class="hs-item-label">{aiEntry.label}</span>
              </span>
            </div>
          {/each}
        {/if}

        {#if tier === 'free'}
          <div class="hs-group-label">Ask AI</div>
          <div class="hs-item hs-item--locked">
            <span class="hs-item-icon">
              <Icon name="lock" size={14} />
            </span>
            <span class="hs-item-copy">
              <span class="hs-item-label">AI assistant is available on Standard and above</span>
            </span>
            <a
              href="https://phavo.net/upgrade"
              target="_blank"
              rel="noopener noreferrer"
              class="hs-upgrade"
              onmousedown={(event) => event.stopPropagation()}
            >
              Upgrade
            </a>
          </div>
        {/if}
      {/if}

      {#if aiResponse}
        <div class="hs-ai-response">
          <div class="hs-ai-meta">
            <span class="hs-ai-provider">{aiResponse.provider}</span>
            <button class="hs-back" onclick={() => (aiResponse = null)}>Back</button>
          </div>

          {#if aiLoading}
            <div class="hs-ai-loading">
              <span class="hs-ai-dot"></span>
              <span class="hs-ai-dot"></span>
              <span class="hs-ai-dot"></span>
            </div>
          {:else}
            <div class="hs-ai-text">{aiResponse.text}</div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .hs-wrap {
    position: relative;
    width: 100%;
    min-width: 0;
  }

  .hs-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 40px;
    padding: 0 var(--space-3) 0 calc(var(--space-4) + 14px);
    background: color-mix(in srgb, var(--color-bg-elevated) 94%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-accent) 18%, var(--color-border-subtle));
    border-radius: 999px;
    cursor: text;
    transition:
      border-color 0.15s ease,
      background 0.15s ease,
      box-shadow 0.15s ease,
      border-radius 0.15s ease;
  }

  .hs-bar:hover {
    border-color: color-mix(in srgb, var(--color-accent) 28%, var(--color-border-subtle));
  }

  .hs-bar.open {
    border-color: color-mix(in srgb, var(--color-accent) 34%, var(--color-border-subtle));
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  }

  .hs-leading {
    position: absolute;
    left: var(--space-4);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .hs-input {
    flex: 1;
    min-width: 0;
    padding: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--color-text-primary);
    font-family: var(--font-ui);
    font-size: 13px;
    line-height: 1.2;
  }

  .hs-input::placeholder {
    color: var(--color-text-muted);
  }

  .hs-kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 0 var(--space-2);
    border-radius: 999px;
    border: 1px solid var(--color-border-subtle);
    background: color-mix(in srgb, var(--color-bg-base) 76%, transparent);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    pointer-events: none;
    flex-shrink: 0;
  }

  .hs-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
  }

  .hs-clear:hover {
    color: var(--color-text-primary);
    background: color-mix(in srgb, var(--color-bg-hover) 84%, transparent);
  }

  .hs-dropdown {
    position: absolute;
    top: calc(100% - 1px);
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: min(460px, 72dvh);
    overflow-y: auto;
    padding: var(--space-3);
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--color-bg-elevated) 96%, transparent),
        color-mix(in srgb, var(--color-bg-surface) 98%, transparent)
      );
    border: 1px solid color-mix(in srgb, var(--color-accent) 34%, var(--color-border-subtle));
    border-top: none;
    border-radius: 0 0 var(--radius-xl) var(--radius-xl);
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.38);
    z-index: 999;
    scrollbar-width: thin;
  }

  .hs-hint {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: calc(var(--radius-xl) - 4px);
    background: color-mix(in srgb, var(--color-bg-base) 28%, transparent);
    border: 1px solid var(--color-border-subtle);
  }

  .hs-hint-title {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-accent-text);
  }

  .hs-hint-copy {
    margin: 0;
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .hs-group-label {
    padding: var(--space-3) var(--space-2) var(--space-1);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .hs-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: calc(var(--radius-xl) - 6px);
    cursor: pointer;
    transition: background 0.12s ease, border-color 0.12s ease;
    border: 1px solid transparent;
  }

  .hs-item:hover,
  .hs-item--active {
    background: color-mix(in srgb, var(--color-accent-t) 84%, transparent);
    border-color: color-mix(in srgb, var(--color-accent) 16%, transparent);
  }

  .hs-item--locked {
    cursor: default;
  }

  .hs-item--locked:hover {
    background: color-mix(in srgb, var(--color-bg-base) 28%, transparent);
    border-color: transparent;
  }

  .hs-item-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-bg-base) 52%, transparent);
    color: var(--color-accent-text);
  }

  .hs-item-copy {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .hs-item-label {
    color: var(--color-text-primary);
    font-size: 13px;
    line-height: 1.35;
  }

  .hs-item-sub {
    color: var(--color-text-muted);
    font-size: 11px;
    line-height: 1.4;
  }

  .hs-upgrade {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 30px;
    padding: 0 var(--space-3);
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--color-accent) 24%, transparent);
    background: color-mix(in srgb, var(--color-bg-base) 64%, transparent);
    color: var(--color-accent-text);
    font-size: 11px;
    font-weight: 700;
    text-decoration: none;
    flex-shrink: 0;
  }

  .hs-ai-response {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-2);
    padding: var(--space-4);
    border-top: 1px solid var(--color-border-subtle);
  }

  .hs-ai-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .hs-ai-provider {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-accent-text);
  }

  .hs-ai-text {
    font-size: 13px;
    line-height: 1.65;
    color: var(--color-text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .hs-back {
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
  }

  .hs-ai-loading {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2) 0;
  }

  .hs-ai-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--color-accent);
    animation: hs-pulse 1.2s ease-in-out infinite;
  }

  .hs-ai-dot:nth-child(2) {
    animation-delay: 0.2s;
  }

  .hs-ai-dot:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes hs-pulse {
    0%,
    80%,
    100% {
      opacity: 0.32;
      transform: scale(0.8);
    }

    40% {
      opacity: 1;
      transform: scale(1);
    }
  }

  @media (max-width: 639px) {
    .hs-bar {
      min-height: 38px;
      padding-right: var(--space-2);
    }

    .hs-kbd {
      display: none;
    }

    .hs-dropdown {
      right: 0;
      left: auto;
      width: min(360px, calc(100vw - (var(--space-4) * 2)));
    }
  }
</style>
