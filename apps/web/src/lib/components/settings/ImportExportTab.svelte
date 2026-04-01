<script lang="ts">
  import { Button, Icon, Input, Switch } from '@phavo/ui';
  import en from '$lib/i18n/en.json';
  import { fetchWithCsrf } from '$lib/utils/api';
  import SettingsSection from './SettingsSection.svelte';

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

<SettingsSection
  eyebrow="Backup"
  title={en.settings.exportSection}
  description={en.settings.exportDescription}
>
  <div class="section">
    <div class="toggle-row">
      <Switch bind:checked={includeCredentials} label={en.settings.includeCredentials} />
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
      <Button disabled={exporting} onclick={handleExport}>
        {exporting ? en.settings.exporting : en.settings.exportButton}
      </Button>
    </div>
  </div>
</SettingsSection>

<SettingsSection
  title={en.settings.importSection}
  description={en.settings.importDescription}
  tone="accent"
>
  <div class="section">
    <input
      type="file"
      accept=".phavo,.json,application/json"
      class="file-input-hidden"
      bind:this={fileInputEl}
      onchange={handleFileInput}
    />

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
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') openFilePicker();
      }}
    >
      {#if parsedExport}
        <span class="drop-zone-icon"><Icon name="check" size={18} /></span>
        <span class="drop-zone-text">{selectedFile?.name ?? en.settings.importFileSelected}</span>
      {:else}
        <span class="drop-zone-icon"><Icon name="upload" size={18} /></span>
        <span class="drop-zone-text">{en.settings.importDropZone}</span>
      {/if}
    </div>

    {#if importParseError}
      <p class="error-msg">{importParseError}</p>
    {/if}

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
            {#each importWarnings as warning}
              <li>{warning}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="action-row">
        <Button variant="secondary" disabled={importing || importSuccess} onclick={handleImport}>
          {importing ? en.settings.importing : en.settings.importConfirm}
        </Button>
      </div>
    {/if}
  </div>
</SettingsSection>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
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
    line-height: 1.5;
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

  .file-input-hidden {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .drop-zone {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 132px;
    padding: var(--space-6) var(--space-4);
    border: 1px dashed color-mix(in srgb, var(--color-accent) 26%, var(--color-border));
    border-radius: calc(var(--radius-xl) - 4px);
    background:
      radial-gradient(
        ellipse 55% 60% at 50% 0%,
        color-mix(in srgb, var(--color-accent-t) 26%, transparent),
        transparent 72%
      ),
      color-mix(in srgb, var(--color-bg-elevated) 76%, transparent);
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
    text-align: center;
  }

  .drop-zone:hover,
  .drop-zone.drag-over {
    border-color: color-mix(in srgb, var(--color-accent) 48%, transparent);
    background:
      radial-gradient(
        ellipse 55% 60% at 50% 0%,
        color-mix(in srgb, var(--color-accent-t) 34%, transparent),
        transparent 72%
      ),
      color-mix(in srgb, var(--color-bg-hover) 80%, transparent);
  }

  .drop-zone.has-file {
    border-style: solid;
  }

  .drop-zone-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--color-accent-text);
  }

  .drop-zone-text {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .preview-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border-radius: calc(var(--radius-xl) - 4px);
    border: 1px solid var(--color-border-subtle);
    background: color-mix(in srgb, var(--color-bg-base) 26%, transparent);
  }

  .preview-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .preview-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: 0;
    margin: 0;
    list-style: none;
  }

  .preview-list li {
    padding: var(--space-2) var(--space-3);
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-bg-hover) 80%, transparent);
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .warnings-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-4);
    border-radius: calc(var(--radius-xl) - 4px);
    border: 1px solid color-mix(in srgb, var(--color-warning) 32%, transparent);
    background: color-mix(in srgb, var(--color-warning-subtle) 84%, transparent);
  }

  .warnings-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .warnings-list {
    margin: 0;
    padding-left: var(--space-4);
    color: var(--color-text-secondary);
  }

  .warnings-list li {
    line-height: 1.5;
  }
</style>
