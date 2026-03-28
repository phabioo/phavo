<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, Card, Input, Switch } from '@phavo/ui';
  import en from '$lib/i18n/en.json';
  import { fetchWithCsrf } from '$lib/utils/api';

  // ─── State ────────────────────────────────────────────────────────────────

  // Export
  let includeCredentials = $state(false);
  let exportPassphrase = $state('');
  let exporting = $state(false);
  let exportError = $state('');

  // Import
  let dragOver = $state(false);
  let selectedFile = $state<File | null>(null);
  let parsedExport = $state<ParsedExport | null>(null);
  let importParseError = $state('');
  let importPassphrase = $state('');
  let importing = $state(false);
  let importError = $state('');
  let importWarnings = $state<string[]>([]);
  let importSuccess = $state(false);

  // ─── Types ────────────────────────────────────────────────────────────────

  interface ParsedExport {
    version: string;
    exportedAt: number;
    tabs: Array<{ id: string; label: string; order: number }>;
    widgetInstances: Array<{ id: string; widgetId: string }>;
    hasCredentials: boolean;
    rawJson: string;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function pluralise(n: number, singular: string, plural: string): string {
    return n === 1 ? singular.replace('{n}', String(n)) : plural.replace('{n}', String(n));
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  async function handleExport(): Promise<void> {
    if (includeCredentials && !exportPassphrase.trim()) {
      exportError = en.settings.passphraseRequired;
      return;
    }
    exportError = '';
    exporting = true;

    try {
      const url = new URL('/api/v1/config/export', window.location.origin);

      let res: Response;
      if (includeCredentials) {
        res = await fetchWithCsrf(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ passphrase: exportPassphrase }),
        });
      } else {
        res = await fetchWithCsrf(url.toString(), { method: 'GET' });
      }

      if (!res.ok) {
        let msg = 'Export failed';
        try {
          const payload = (await res.json()) as { error?: string };
          if (payload.error) msg = payload.error;
        } catch {
          // ignore
        }
        exportError = msg;
        return;
      }

      const json: unknown = await res.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/x-phavo-config' });
      const dateStr = new Date().toISOString().slice(0, 10);
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `phavo-config-${dateStr}.phavo`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
    } catch {
      exportError = 'Export failed — please try again.';
    } finally {
      exporting = false;
    }
  }

  // ─── Import file handling ─────────────────────────────────────────────────

  function parseFile(file: File): void {
    importParseError = '';
    parsedExport = null;
    importWarnings = [];
    importError = '';
    importSuccess = false;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== 'string') {
        importParseError = en.settings.importInvalidJson;
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        importParseError = en.settings.importInvalidJson;
        return;
      }

      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('version' in parsed) ||
        !('tabs' in parsed) ||
        !('widgetInstances' in parsed)
      ) {
        importParseError = en.settings.importInvalidEnvelope;
        return;
      }

      const raw = parsed as Record<string, unknown>;
      parsedExport = {
        version: String(raw.version ?? ''),
        exportedAt: Number(raw.exportedAt ?? 0),
        tabs: Array.isArray(raw.tabs) ? (raw.tabs as ParsedExport['tabs']) : [],
        widgetInstances: Array.isArray(raw.widgetInstances)
          ? (raw.widgetInstances as ParsedExport['widgetInstances'])
          : [],
        hasCredentials: typeof raw.credentials === 'string' && raw.credentials.length > 0,
        rawJson: text,
      };
    };
    reader.onerror = () => {
      importParseError = en.settings.importInvalidJson;
    };
    reader.readAsText(file);
  }

  function handleFileInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      selectedFile = file;
      parseFile(file);
    }
  }

  function handleDrop(e: DragEvent): void {
    dragOver = false;
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      selectedFile = file;
      parseFile(file);
    }
  }

  function handleDragOver(e: DragEvent): void {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave(): void {
    dragOver = false;
  }

  // ─── Import submit ────────────────────────────────────────────────────────

  async function handleImport(): Promise<void> {
    if (!parsedExport) return;
    importing = true;
    importError = '';
    importWarnings = [];
    importSuccess = false;

    try {
      const body: { exportJson: string; passphrase?: string } = {
        exportJson: parsedExport.rawJson,
      };
      if (parsedExport.hasCredentials && importPassphrase.trim()) {
        body.passphrase = importPassphrase;
      }

      const res = await fetchWithCsrf('/api/v1/config/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const payload = (await res.json()) as {
        ok: boolean;
        data?: { warnings?: string[] };
        error?: string;
      };

      if (!payload.ok) {
        importError = payload.error ?? 'Import failed';
        return;
      }

      importWarnings = payload.data?.warnings ?? [];
      importSuccess = true;

      // Full page reload after 1.5s so the store re-fetches fresh data.
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch {
      importError = 'Import failed — please try again.';
    } finally {
      importing = false;
    }
  }

  // ─── File input ref (reactive click target) ───────────────────────────────

  let fileInputEl = $state<HTMLInputElement | undefined>(undefined);

  function openFilePicker(): void {
    fileInputEl?.click();
  }

  // Keep file input in sync with bind
  onMount(() => {
    // Nothing needed; $effect.root handles reactive side-effects if required.
  });
</script>

<!-- ── Export section ──────────────────────────────────────────────────────── -->
<Card padding="none">
  <div class="section">
    <h2 class="section-title">{en.settings.exportSection}</h2>
    <p class="section-desc">{en.settings.exportDescription}</p>

    <div class="toggle-row">
      <Switch
        bind:checked={includeCredentials}
        label={en.settings.includeCredentials}
      />
    </div>

    {#if includeCredentials}
      <p class="hint">{en.settings.includeCredentialsHint}</p>
      <Input
        type="password"
        label={en.settings.passphrase}
        placeholder={en.settings.passphrasePlaceholder}
        bind:value={exportPassphrase}
      />
    {/if}

    {#if exportError}
      <p class="error-msg">{exportError}</p>
    {/if}

    <div class="action-row">
      <Button variant="primary" disabled={exporting} onclick={handleExport}>
        {exporting ? en.settings.exporting : en.settings.exportButton}
      </Button>
    </div>
  </div>
</Card>

<!-- ── Import section ──────────────────────────────────────────────────────── -->
<Card padding="none">
  <div class="section">
    <h2 class="section-title">{en.settings.importSection}</h2>
    <p class="section-desc">{en.settings.importDescription}</p>

    <!-- Hidden file input -->
    <input
      type="file"
      accept=".phavo,.json,application/json"
      class="file-input-hidden"
      bind:this={fileInputEl}
      onchange={handleFileInput}
    />

    <!-- Drop zone -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="drop-zone"
      class:drag-over={dragOver}
      class:has-file={!!parsedExport}
      onclick={openFilePicker}
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      role="button"
      tabindex="0"
      aria-label={en.settings.importDropZone}
      onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') openFilePicker(); }}
    >
      {#if parsedExport}
        <span class="drop-zone-icon">✓</span>
        <span class="drop-zone-text">{selectedFile?.name ?? en.settings.importFileSelected}</span>
      {:else}
        <span class="drop-zone-icon">↑</span>
        <span class="drop-zone-text">{en.settings.importDropZone}</span>
      {/if}
    </div>

    {#if importParseError}
      <p class="error-msg">{importParseError}</p>
    {/if}

    <!-- Preview panel -->
    {#if parsedExport && !importParseError}
      <div class="preview-panel">
        <p class="preview-title">{en.settings.importPreviewTitle}</p>
        <ul class="preview-list">
          <li>{pluralise(parsedExport.tabs.length, en.settings.importPreviewTabs, en.settings.importPreviewTabsPlural)}</li>
          <li>{pluralise(parsedExport.widgetInstances.length, en.settings.importPreviewWidgets, en.settings.importPreviewWidgetsPlural)}</li>
          <li>{parsedExport.hasCredentials ? en.settings.importPreviewCredentials : en.settings.importPreviewNoCredentials}</li>
        </ul>

        {#if parsedExport.hasCredentials}
          <p class="hint">{en.settings.importPassphraseHint}</p>
          <Input
            type="password"
            label={en.settings.passphrase}
            placeholder={en.settings.passphrasePlaceholder}
            bind:value={importPassphrase}
          />
        {/if}
      </div>

      {#if importError}
        <p class="error-msg">{importError}</p>
      {/if}

      {#if importSuccess}
        <p class="success-msg">{en.settings.importSuccess}</p>
      {/if}

      {#if importWarnings.length > 0}
        <div class="warnings-panel">
          <p class="warnings-title">{en.settings.importWarnings}</p>
          <ul class="warnings-list">
            {#each importWarnings as w}
              <li>{w}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="action-row">
        <Button
          variant="secondary"
          disabled={importing || importSuccess}
          onclick={handleImport}
        >
          {importing ? en.settings.importing : en.settings.importConfirm}
        </Button>
      </div>
    {/if}
  </div>
</Card>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
  }

  .section-title {
    color: var(--color-text-primary);
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .section-desc {
    color: var(--color-text-secondary);
    font-size: 13px;
    margin: 0;
    line-height: 1.5;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .hint {
    color: var(--color-text-muted);
    font-size: 12px;
    margin: 0;
    line-height: 1.4;
  }

  .action-row {
    display: flex;
    justify-content: flex-start;
    padding-top: var(--space-1);
  }

  .error-msg {
    color: var(--color-danger);
    font-size: 13px;
    margin: 0;
  }

  .success-msg {
    color: var(--color-success);
    font-size: 13px;
    margin: 0;
  }

  /* Hidden file input */
  .file-input-hidden {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  /* Drop zone */
  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-6) var(--space-4);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-surface);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    min-height: 100px;
    text-align: center;
  }

  .drop-zone:hover,
  .drop-zone.drag-over {
    border-color: var(--color-accent);
    background: var(--color-accent-t);
  }

  .drop-zone.has-file {
    border-style: solid;
    border-color: var(--color-accent);
  }

  .drop-zone-icon {
    font-size: 24px;
    color: var(--color-text-secondary);
  }

  .drop-zone-text {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  /* Preview panel */
  .preview-panel {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .preview-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .preview-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .preview-list li {
    font-size: 13px;
    color: var(--color-text-secondary);
    background: var(--color-bg-hover);
    border-radius: var(--radius-sm);
    padding: var(--space-1) var(--space-2);
  }

  /* Warnings panel */
  .warnings-panel {
    background: var(--color-warning-subtle);
    border: 1px solid var(--color-warning);
    border-radius: var(--radius-sm);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .warnings-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .warnings-list {
    list-style: disc;
    padding-left: var(--space-4);
    margin: 0;
  }

  .warnings-list li {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }
</style>
