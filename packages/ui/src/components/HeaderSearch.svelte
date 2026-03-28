<script lang="ts">
  import { onMount } from 'svelte';

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
    tier?: 'free' | 'standard' | 'local';
    onAction?: ((entry: SearchEntry) => void) | undefined;
    onAiChat?: ((provider: 'ollama' | 'openai' | 'anthropic', query: string) => Promise<string>) | undefined;
  }

  let {
    searchIndex = [],
    searchEngineUrl = 'https://duckduckgo.com/?q={query}',
    aiProviders = { ollama: false, openai: false, anthropic: false },
    tier = 'free',
    onAction,
    onAiChat,
  }: Props = $props();

  let query = $state('');
  let open = $state(false);
  let selectedIndex = $state(0);
  let inputEl = $state<HTMLInputElement>();
  let aiResponse = $state<{ provider: string; text: string } | null>(null);
  let aiLoading = $state(false);
  let isMac = $state(false);

  const MAX_RESULTS = 8;

  const PROVIDER_LABELS: Record<string, string> = {
    ollama: 'Ollama',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
  };

  let results = $derived.by(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return searchIndex
      .filter(e => e.label.toLowerCase().includes(q) || e.subtitle?.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  });

  let engineName = $derived.by(() => {
    try {
      const host = new URL(searchEngineUrl.replace('{query}', 'test')).hostname;
      const name = host.replace(/^www\./, '').split('.')[0] ?? 'Web';
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return 'Web';
    }
  });

  let webSearchEntry = $derived.by(() => {
    if (!query.trim()) return null;
    const q = query.trim();
    const url = searchEngineUrl;
    return {
      id: '__web_search__',
      label: `Search "${q}" on ${engineName}`,
      action: () => {
        window.open(url.replace('{query}', encodeURIComponent(q)), '_blank', 'noopener,noreferrer');
      },
    };
  });

  let aiEntries = $derived.by(() => {
    if (!query.trim()) return [];
    const items: Array<{ id: string; provider: 'ollama' | 'openai' | 'anthropic'; label: string }> = [];
    for (const p of ['ollama', 'openai', 'anthropic'] as const) {
      if (aiProviders[p]) {
        items.push({ id: `__ai_${p}__`, provider: p, label: `Ask ${PROVIDER_LABELS[p]}: "${query}"` });
      }
    }
    return items;
  });

  let totalResults = $derived(
    results.length + (webSearchEntry ? 1 : 0) + (tier !== 'free' ? aiEntries.length : 0),
  );

  function clickOutside(node: HTMLElement, callback: () => void) {
    function handle(e: MouseEvent) {
      if (!node.contains(e.target as Node)) callback();
    }
    document.addEventListener('mousedown', handle);
    return { destroy() { document.removeEventListener('mousedown', handle); } };
  }

  function dismiss() {
    query = '';
    open = false;
    aiResponse = null;
    inputEl?.blur();
  }

  function handleInput() {
    selectedIndex = 0;
    aiResponse = null;
  }

  function executeSelected() {
    if (totalResults === 0) return;
    const idx = selectedIndex;

    if (idx < results.length) {
      const entry = results[idx];
      if (entry) {
        entry.action();
        onAction?.(entry);
        dismiss();
      }
      return;
    }

    let offset = results.length;
    if (webSearchEntry) {
      if (idx === offset) {
        webSearchEntry.action();
        dismiss();
        return;
      }
      offset++;
    }

    const aiIdx = idx - offset;
    const aiEntry = aiEntries[aiIdx];
    if (aiEntry) {
      void askAi(aiEntry.provider);
    }
  }

  async function askAi(provider: 'ollama' | 'openai' | 'anthropic') {
    if (!onAiChat || !query.trim()) return;
    aiLoading = true;
    const providerLabel = PROVIDER_LABELS[provider] ?? provider;
    aiResponse = { provider: providerLabel, text: '' };
    try {
      const text = await onAiChat(provider, query);
      aiResponse = { provider: providerLabel, text };
    } catch {
      aiResponse = { provider: providerLabel, text: 'Failed to get a response.' };
    } finally {
      aiLoading = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalResults > 0) selectedIndex = Math.min(selectedIndex + 1, totalResults - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalResults > 0) selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeSelected();
    } else if (e.key === 'Escape') {
      dismiss();
    }
  }

  function handleGlobalKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
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
<div class="hs-wrap" use:clickOutside={() => { open = false; }}>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="hs-bar"
    class:open={open}
    onclick={() => { open = true; requestAnimationFrame(() => inputEl?.focus()); }}
  >
    <svg class="hs-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
    <input
      bind:this={inputEl}
      bind:value={query}
      class="hs-input"
      placeholder="Search or ask…"
      onfocus={() => { open = true; }}
      oninput={handleInput}
      onkeydown={handleKeydown}
      autocomplete="off"
      spellcheck="false"
      aria-label="Search or ask"
    />
    {#if query}
      <button class="hs-clear" onclick={() => { query = ''; aiResponse = null; selectedIndex = 0; inputEl?.focus(); }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    {:else}
      <kbd class="hs-kbd">{isMac ? '⌘K' : 'Ctrl+K'}</kbd>
    {/if}
  </div>

  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="hs-dropdown" onmousedown={(e) => e.preventDefault()}>

      {#if !query.trim()}
        <div class="hs-hint">Type to search…</div>
      {:else}

        {#if results.length > 0}
          <div class="hs-group-label">DASHBOARD</div>
          {#each results as entry, i}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="hs-item"
              class:hs-item--active={selectedIndex === i}
              onmouseenter={() => { selectedIndex = i; }}
              onmousedown={() => { entry.action(); onAction?.(entry); dismiss(); }}
            >
              <span class="hs-item-icon">{@html entry.icon ?? '→'}</span>
              <span class="hs-item-label">{entry.label}</span>
              {#if entry.subtitle}
                <span class="hs-item-sub">{entry.subtitle}</span>
              {/if}
            </div>
          {/each}
        {/if}

        {#if webSearchEntry}
          <div class="hs-group-label">WEB SEARCH</div>
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="hs-item"
            class:hs-item--active={selectedIndex === results.length}
            onmouseenter={() => { selectedIndex = results.length; }}
            onmousedown={() => { webSearchEntry?.action(); dismiss(); }}
          >
            <span class="hs-item-icon">🌐</span>
            <span class="hs-item-label">Search "{query}" on {engineName}</span>
          </div>
        {/if}

        {#if tier !== 'free' && aiEntries.length > 0}
          <div class="hs-group-label">ASK AI</div>
          {#each aiEntries as aiEntry, i}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div
              class="hs-item"
              class:hs-item--active={selectedIndex === results.length + 1 + i}
              onmouseenter={() => { selectedIndex = results.length + 1 + i; }}
              onmousedown={() => { void askAi(aiEntry.provider); }}
            >
              <span class="hs-item-icon">🤖</span>
              <span class="hs-item-label">{aiEntry.label}</span>
            </div>
          {/each}
        {/if}

        {#if tier === 'free'}
          <div class="hs-group-label">ASK AI</div>
          <div class="hs-item hs-item--locked">
            <span class="hs-item-icon">🔒</span>
            <span class="hs-item-label">AI assistant — Standard+</span>
            <a
              href="https://phavo.net/upgrade"
              target="_blank"
              rel="noopener noreferrer"
              class="hs-upgrade"
              onmousedown={(e) => e.stopPropagation()}
            >Upgrade →</a>
          </div>
        {/if}

      {/if}

      {#if aiResponse}
        <div class="hs-ai-response">
          <div class="hs-ai-meta">{aiResponse.provider}</div>
          {#if aiLoading}
            <div class="hs-ai-loading">
              <span class="hs-ai-dot"></span>
              <span class="hs-ai-dot"></span>
              <span class="hs-ai-dot"></span>
            </div>
          {:else}
            <div class="hs-ai-text">{aiResponse.text}</div>
          {/if}
          <button class="hs-back" onclick={() => { aiResponse = null; }}>← Back</button>
        </div>
      {/if}

    </div>
  {/if}

</div>

<style>
  .hs-wrap {
    position: relative;
    flex: 0 0 420px;
  }

  .hs-bar {
    display: flex;
    align-items: center;
    height: 34px;
    padding: 0 10px 0 34px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    position: relative;
    cursor: text;
    transition: border-color 0.15s;
  }

  .hs-bar.open {
    border-color: var(--color-accent);
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom-color: var(--color-bg-elevated);
  }

  .hs-bar:not(.open):hover {
    border-color: var(--color-text-muted);
  }

  .hs-icon {
    position: absolute;
    left: 12px;
    width: 14px;
    height: 14px;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .hs-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: var(--font-ui);
    font-size: 13px;
    color: var(--color-text);
    min-width: 0;
  }

  .hs-input::placeholder {
    color: var(--color-text-muted);
  }

  .hs-kbd {
    flex-shrink: 0;
    padding: 1px 5px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .hs-clear {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--color-text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .hs-clear:hover {
    color: var(--color-text);
  }

  .hs-dropdown {
    position: absolute;
    top: calc(100% - 1px);
    left: 0;
    right: 0;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-accent);
    border-top: none;
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
    max-height: 420px;
    overflow-y: auto;
    z-index: 9999;
  }

  .hs-hint {
    padding: 16px;
    text-align: center;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .hs-group-label {
    padding: 8px 12px 3px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
  }

  .hs-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    font-size: 13px;
    color: var(--color-text);
    cursor: pointer;
    transition: background 0.08s;
  }

  .hs-item:hover,
  .hs-item--active {
    background: rgba(212, 146, 42, 0.10);
  }

  .hs-item--active {
    border-left: 2px solid var(--color-accent);
    padding-left: 10px;
  }

  .hs-item--locked {
    cursor: default;
    color: var(--color-text-muted);
  }

  .hs-item--locked:hover {
    background: transparent;
  }

  .hs-item-icon {
    font-size: 12px;
    color: var(--color-text-muted);
    flex-shrink: 0;
    width: 16px;
    text-align: center;
  }

  .hs-item-label {
    flex: 1;
  }

  .hs-item-sub {
    margin-left: auto;
    font-size: 11px;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .hs-upgrade {
    margin-left: auto;
    font-size: 11px;
    color: var(--color-accent);
    text-decoration: none;
  }

  .hs-upgrade:hover {
    text-decoration: underline;
  }

  .hs-ai-response {
    padding: 14px 12px;
    border-top: 1px solid var(--color-border-subtle);
  }

  .hs-ai-meta {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 8px;
  }

  .hs-ai-text {
    font-size: 13px;
    color: var(--color-text);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .hs-back {
    margin-top: 10px;
    font-size: 12px;
    color: var(--color-text-muted);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: var(--font-ui);
  }

  .hs-back:hover {
    color: var(--color-text);
  }

  .hs-ai-loading {
    display: flex;
    gap: 6px;
    padding: 8px 0;
  }

  .hs-ai-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-accent);
    animation: hs-pulse 1.2s ease-in-out infinite;
  }

  .hs-ai-dot:nth-child(2) { animation-delay: 0.2s; }
  .hs-ai-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes hs-pulse {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1); }
  }

  @media (max-width: 640px) {
    .hs-wrap { flex: 0 0 40px; }
    .hs-bar { padding: 0; justify-content: center; }
    .hs-input, .hs-kbd { display: none; }
    .hs-icon { position: static; }
    .hs-bar.open { padding: 0 10px 0 34px; }
    .hs-bar.open .hs-input { display: block; }
    .hs-bar.open .hs-kbd { display: inline-flex; }
    .hs-bar.open .hs-icon { position: absolute; left: 12px; }
    .hs-dropdown {
      left: auto;
      right: 0;
      width: 320px;
    }
  }
</style>
