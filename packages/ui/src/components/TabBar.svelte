<script lang="ts">
  import type { Tab } from '@phavo/types';
  import * as icons from '../icons/icons';

  interface Props {
    tabs: Tab[];
    activeTabId: string;
    canAddTab: boolean;
    onSelectTab: (id: string) => void;
    onAddTab: (label: string) => void;
    onLockedAddTab?: () => void;
    onRenameTab: (id: string, label: string) => void;
    onDeleteTab: (id: string) => void;
    addTabLabel?: string;
    /** i18n labels for context menu and inline input */
    labels?: {
      rename?: string;
      delete?: string;
      deleteConfirm?: string;
      tabPlaceholder?: string;
    };
  }

  let {
    tabs,
    activeTabId,
    canAddTab,
    onSelectTab,
    onAddTab,
    onLockedAddTab,
    onRenameTab,
    onDeleteTab,
    addTabLabel = '+',
    labels = {},
  }: Props = $props();

  let contextTabId = $state<string | null>(null);
  let contextPos = $state({ x: 0, y: 0 });
  let contextAnchorRect = $state<DOMRect | null>(null);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  // Inline editing state
  let isCreating = $state(false);
  let editingTabId = $state<string | null>(null);
  let editValue = $state('');
  let confirmingDeleteId = $state<string | null>(null);

  function showContext(id: string, e: MouseEvent) {
    e.preventDefault();
    const pill = (e.currentTarget as HTMLElement);
    contextAnchorRect = pill.getBoundingClientRect();
    contextTabId = id;
    contextPos = { x: 0, y: 0 }; // unused now, using anchor rect
  }

  function handlePointerDown(id: string, e: PointerEvent) {
    if (e.pointerType === 'mouse') return;
    longPressTimer = setTimeout(() => {
      const pill = (e.currentTarget as HTMLElement);
      contextAnchorRect = pill.getBoundingClientRect();
      contextTabId = id;
    }, 500);
  }

  function handlePointerUp() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function closeContext() {
    contextTabId = null;
    contextAnchorRect = null;
    confirmingDeleteId = null;
  }

  function handleRenameClick() {
    if (!contextTabId) return;
    const tab = tabs.find((t) => t.id === contextTabId);
    editingTabId = contextTabId;
    editValue = tab?.label ?? '';
    closeContext();
  }

  function handleDeleteClick() {
    if (!contextTabId) return;
    confirmingDeleteId = contextTabId;
  }

  function handleDeleteConfirm() {
    if (confirmingDeleteId) {
      onDeleteTab(confirmingDeleteId);
    }
    closeContext();
  }

  // ── Inline-create (new tab) ─────────────────────────────────────────
  function startCreate() {
    if (!canAddTab) {
      onLockedAddTab?.();
      return;
    }

    isCreating = true;
    editValue = '';
  }

  function commitCreate() {
    const label = editValue.trim();
    isCreating = false;
    editValue = '';
    if (label) onAddTab(label);
  }

  function cancelCreate() {
    isCreating = false;
    editValue = '';
  }

  function handleCreateKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitCreate();
    else if (e.key === 'Escape') cancelCreate();
  }

  // ── Inline-rename ──────────────────────────────────────────────────
  function commitRename() {
    const label = editValue.trim();
    const id = editingTabId;
    editingTabId = null;
    editValue = '';
    if (id && label) onRenameTab(id, label);
  }

  function cancelRename() {
    editingTabId = null;
    editValue = '';
  }

  function handleRenameKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitRename();
    else if (e.key === 'Escape') cancelRename();
  }

  function autofocus(node: HTMLInputElement) {
    requestAnimationFrame(() => node.focus());
  }
</script>

<svelte:window onclick={closeContext} />

<div class="tab-bar" role="tablist">
  {#each tabs as tab (tab.id)}
    {#if editingTabId === tab.id}
      <input
        class="tab-pill tab-input"
        type="text"
        bind:value={editValue}
        onblur={commitRename}
        onkeydown={handleRenameKeydown}
        placeholder={labels.tabPlaceholder ?? 'Tab name'}
        use:autofocus
      />
    {:else}
      <button
        class="tab-pill"
        class:tab-active={tab.id === activeTabId}
        role="tab"
        aria-selected={tab.id === activeTabId}
        onclick={() => onSelectTab(tab.id)}
        oncontextmenu={(e) => showContext(tab.id, e)}
        onpointerdown={(e) => handlePointerDown(tab.id, e)}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerUp}
      >
        {tab.label}
      </button>
    {/if}
  {/each}

  {#if isCreating}
    <input
      class="tab-pill tab-input"
      type="text"
      bind:value={editValue}
      onblur={commitCreate}
      onkeydown={handleCreateKeydown}
      placeholder={labels.tabPlaceholder ?? 'Tab name'}
      use:autofocus
    />
  {:else if canAddTab}
    <button
      class="tab-pill tab-add"
      class:tab-add-disabled={!canAddTab}
      onclick={startCreate}
      aria-label={addTabLabel}
      aria-disabled={!canAddTab}
    >
      {@html icons.plus()}
    </button>
  {:else}
    <button
      class="tab-pill tab-add tab-add-disabled"
      onclick={startCreate}
      aria-label={addTabLabel}
      aria-disabled="true"
    >
      {@html icons.plus()}
    </button>
  {/if}
</div>

{#if contextTabId}
  <div
    class="tab-ctx"
    role="menu"
    aria-label="Tab options"
    tabindex="-1"
    style="left:{contextAnchorRect ? contextAnchorRect.left : contextPos.x}px;top:{contextAnchorRect ? contextAnchorRect.bottom + 4 : contextPos.y}px"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => { if (e.key === 'Escape') closeContext(); e.stopPropagation(); }}
  >
    {#if confirmingDeleteId}
      <span class="tab-ctx-confirm-text">{labels.deleteConfirm ?? 'Delete this tab?'}</span>
      <button class="tab-ctx-item tab-ctx-danger" role="menuitem" onclick={handleDeleteConfirm}>
        {labels.delete ?? 'Delete'}
      </button>
    {:else}
      <button class="tab-ctx-item" role="menuitem" onclick={handleRenameClick}>{labels.rename ?? 'Rename'}</button>
      {#if tabs.length > 1}
        <button class="tab-ctx-item tab-ctx-danger" role="menuitem" onclick={handleDeleteClick}>{labels.delete ?? 'Delete'}</button>
      {/if}
    {/if}
  </div>
{/if}

<style>
  .tab-bar {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0 var(--space-6);
    height: 40px;
    background: var(--color-surface);
    border-bottom: 1px solid color-mix(in srgb, var(--color-outline-variant) 10%, transparent);
    overflow-x: auto;
    flex-shrink: 0;
  }

  .tab-pill {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-outline);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s, border-color 0.15s;
    height: 100%;
  }

  .tab-pill:hover {
    color: var(--color-text);
  }

  .tab-active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
    font-weight: 600;
  }

  .tab-input {
    width: 100px;
    font-family: inherit;
    cursor: text;
    color: var(--color-text);
    border-bottom-color: var(--color-primary);
    outline: none;
  }

  .tab-add {
    color: var(--color-outline);
    padding: var(--space-1) var(--space-2);
  }

  .tab-add:hover {
    color: var(--color-primary);
  }

  .tab-add-disabled {
    color: var(--color-outline);
    opacity: 0.45;
  }

  .tab-add-disabled:hover {
    color: var(--color-outline);
  }

  /* Context menu */
  .tab-ctx {
    position: fixed;
    z-index: var(--z-popover, 300);
    background: var(--color-surface-card);
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 15%, transparent);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--color-surface-dim) 15%, transparent);
    padding: var(--space-1) 0;
    width: fit-content;
  }

  .tab-ctx-item {
    display: block;
    width: 100%;
    padding: var(--space-2) 12px;
    font-size: 13px;
    color: var(--color-text);
    background: none;
    border: none;
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
  }

  .tab-ctx-item:hover {
    background: var(--color-surface-high);
  }

  .tab-ctx-danger {
    color: var(--color-danger);
  }

  .tab-ctx-confirm-text {
    display: block;
    padding: var(--space-2) 12px;
    font-size: 12px;
    color: var(--color-outline);
    white-space: nowrap;
  }
</style>
