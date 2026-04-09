<script lang="ts">
  import { Button, Icon, Input } from '@phavo/ui';
  import en from '$lib/i18n/en.json';
  import { fetchWithCsrf } from '$lib/utils/api';

  interface ParsedExport {
    version: string;
    exportedAt: number;
    tabs: Array<{ id: string; label: string; order: number }>;
    widgetInstances: Array<{ id: string; widgetId: string }>;
    hasCredentials: boolean;
    rawJson: string;
  }

  let includeCredentials = $state(false);
  let exportPassphrase = $state('');
  let exporting = $state(false);
  let exportError = $state('');

  let dragOver = $state(false);
  let selectedFile = $state<File | null>(null);
  let parsedExport = $state<ParsedExport | null>(null);
  let importParseError = $state('');
  let importPassphrase = $state('');
  let importing = $state(false);
  let importError = $state('');
  let importWarnings = $state<string[]>([]);
  let importSuccess = $state(false);
  let fileInputEl = $state<HTMLInputElement | undefined>(undefined);

  function pluralise(n: number, singular: string, plural: string): string {
    return n === 1 ? singular.replace('{n}', String(n)) : plural.replace('{n}', String(n));
  }

  async function handleExport(): Promise<void> {
    if (includeCredentials && !exportPassphrase.trim()) {
      exportError = en.settings.passphraseRequired;
      return;
    }

    exportError = '';
    exporting = true;

    try {
      const url = new URL('/api/v1/config/export', window.location.origin);
      let response: Response;

      if (includeCredentials) {
        response = await fetchWithCsrf(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passphrase: exportPassphrase }),
        });
      } else {
        response = await fetchWithCsrf(url.toString(), { method: 'GET' });
      }

      if (!response.ok) {
        let message = 'Export failed';
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          // Ignore malformed error payloads.
        }
        exportError = message;
        return;
      }

      const payload: unknown = await response.json();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/x-phavo-config',
      });
      const dateString = new Date().toISOString().slice(0, 10);
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `phavo-config-${dateString}.phavo`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(blobUrl);
    } catch {
      exportError = 'Export failed - please try again.';
    } finally {
      exporting = false;
    }
  }

  function parseFile(file: File): void {
    importParseError = '';
    parsedExport = null;
    importWarnings = [];
    importError = '';
    importSuccess = false;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
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

  function handleFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    selectedFile = file;
    parseFile(file);
  }

  function handleDrop(event: DragEvent): void {
    dragOver = false;
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    selectedFile = file;
    parseFile(file);
  }

  function handleDragOver(event: DragEvent): void {
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave(): void {
    dragOver = false;
  }

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

      const response = await fetchWithCsrf('/api/v1/config/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as {
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

      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } catch {
      importError = 'Import failed - please try again.';
    } finally {
      importing = false;
    }
  }

  function openFilePicker(): void {
    fileInputEl?.click();
  }
</script>

<div class="settings-cards-grid">
  <div class="settings-hero-card settings-card-full">
    <span class="settings-card-label">BACKUP</span>
    <h2 class="settings-hero-value">Backup & Export</h2>
    <p class="settings-hero-sub">Create portable backups and restore configurations</p>
  </div>

  <div class="settings-form-card">
    <h3 class="settings-form-title">{en.settings.exportSection}</h3>
    <p class="ie-description">{en.settings.exportDescription}</p>

    <div class="ie-toggle-row">
      <button
        class="settings-toggle-pill"
        class:settings-toggle-pill-active={includeCredentials}
        type="button"
        onclick={() => (includeCredentials = !includeCredentials)}
      >
        <Icon name={includeCredentials ? 'check' : 'x'} size={12} />
        {en.settings.includeCredentials}
      </button>
    </div>

    {#if includeCredentials}
      <p class="ie-hint">{en.settings.includeCredentialsHint}</p>
      <div>
        <label class="settings-field-label">{en.settings.passphrase}</label>
        <Input
          type="password"
          placeholder={en.settings.passphrasePlaceholder}
          bind:value={exportPassphrase}
        />
      </div>
    {/if}

    {#if exportError}
      <p class="ie-error">{exportError}</p>
    {/if}

    <div class="settings-form-actions">
      <span></span>
      <button class="settings-btn-primary" type="button" disabled={exporting} onclick={handleExport}>
        {exporting ? en.settings.exporting : en.settings.exportButton}
      </button>
    </div>
  </div>

  <div class="settings-form-card">
    <h3 class="settings-form-title">{en.settings.importSection}</h3>
    <p class="ie-description">{en.settings.importDescription}</p>

    <input
      type="file"
      accept=".phavo,.json,application/json"
      class="ie-file-hidden"
      bind:this={fileInputEl}
      onchange={handleFileInput}
    />

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="ie-drop-zone"
      class:ie-drag-over={dragOver}
      class:ie-has-file={!!parsedExport}
      onclick={openFilePicker}
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
      role="button"
      tabindex="0"
      aria-label={en.settings.importDropZone}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') openFilePicker();
      }}
    >
      {#if parsedExport}
        <Icon name="check" size={18} />
        <span class="ie-drop-text">{selectedFile?.name ?? en.settings.importFileSelected}</span>
      {:else}
        <Icon name="upload" size={18} />
        <span class="ie-drop-text">{en.settings.importDropZone}</span>
      {/if}
    </div>

    {#if importParseError}
      <p class="ie-error">{importParseError}</p>
    {/if}

    {#if parsedExport && !importParseError}
      <div class="ie-preview-panel">
        <p class="ie-preview-title">{en.settings.importPreviewTitle}</p>
        <ul class="ie-preview-list">
          <li>{pluralise(parsedExport.tabs.length, en.settings.importPreviewTabs, en.settings.importPreviewTabsPlural)}</li>
          <li>{pluralise(parsedExport.widgetInstances.length, en.settings.importPreviewWidgets, en.settings.importPreviewWidgetsPlural)}</li>
          <li>{parsedExport.hasCredentials ? en.settings.importPreviewCredentials : en.settings.importPreviewNoCredentials}</li>
        </ul>

        {#if parsedExport.hasCredentials}
          <p class="ie-hint">{en.settings.importPassphraseHint}</p>
          <div>
            <label class="settings-field-label">{en.settings.passphrase}</label>
            <Input
              type="password"
              placeholder={en.settings.passphrasePlaceholder}
              bind:value={importPassphrase}
            />
          </div>
        {/if}
      </div>

      {#if importError}
        <p class="ie-error">{importError}</p>
      {/if}

      {#if importSuccess}
        <p class="ie-success">{en.settings.importSuccess}</p>
      {/if}

      {#if importWarnings.length > 0}
        <div class="ie-warnings">
          <p class="ie-preview-title">{en.settings.importWarnings}</p>
          <ul class="ie-warnings-list">
            {#each importWarnings as warning}
              <li>{warning}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="settings-form-actions">
        <span></span>
        <button class="settings-btn-primary" type="button" disabled={importing || importSuccess} onclick={handleImport}>
          {importing ? en.settings.importing : en.settings.importConfirm}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  /* ie-layout replaced by settings-cards-grid from theme.css */

  .ie-description {
    font-size: 13px;
    color: var(--color-on-surface-variant);
    margin: 0;
    line-height: 1.5;
  }

  .ie-toggle-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .ie-hint {
    color: var(--color-on-surface-variant);
    font-size: 12px;
    margin: 0;
    line-height: 1.5;
  }

  .ie-error {
    color: var(--color-error);
    font-size: 13px;
    margin: 0;
  }

  .ie-success {
    color: var(--color-secondary);
    font-size: 13px;
    margin: 0;
  }

  .ie-file-hidden {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .ie-drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 132px;
    padding: var(--space-6) var(--space-4);
    border: 1px dashed color-mix(in srgb, var(--color-primary-fixed) 26%, var(--color-outline-variant));
    border-radius: 1.5rem;
    background: color-mix(in srgb, var(--color-surface-dim) 60%, transparent);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    text-align: center;
    color: var(--color-on-surface-variant);
  }

  .ie-drop-zone:hover,
  .ie-drop-zone.ie-drag-over {
    border-color: color-mix(in srgb, var(--color-primary-fixed) 48%, transparent);
    background: color-mix(in srgb, var(--color-surface-high) 60%, transparent);
  }

  .ie-drop-zone.ie-has-file {
    border-style: solid;
    color: var(--color-secondary);
  }

  .ie-drop-text {
    font-size: 13px;
  }

  .ie-preview-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: 1.5rem;
    border: 1px solid color-mix(in srgb, var(--color-outline-variant) 10%, transparent);
    background: color-mix(in srgb, var(--color-surface-dim) 60%, transparent);
  }

  .ie-preview-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-on-surface);
  }

  .ie-preview-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .ie-preview-list li {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-full);
    background: var(--color-surface-highest);
    color: var(--color-on-surface-variant);
    font-size: 12px;
  }

  .ie-warnings {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: 1.5rem;
    border: 1px solid color-mix(in srgb, var(--color-primary-fixed) 32%, transparent);
    background: color-mix(in srgb, var(--color-primary-fixed) 6%, transparent);
  }

  .ie-warnings-list {
    margin: 0;
    padding-left: var(--space-4);
    color: var(--color-on-surface-variant);
  }

  .ie-warnings-list li {
    line-height: 1.5;
  }
</style>
