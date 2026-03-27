<script lang="ts">
  import {
    ensureZodMetaCompat,
    getSchemaMeta,
    MASKED_CREDENTIAL_DISPLAY,
    PRESERVE_CREDENTIAL_VALUE,
    z,
    type SchemaMeta,
  } from '@phavo/types';
  import { onMount } from 'svelte';
  import Button from './Button.svelte';
  import Input from './Input.svelte';
  import Select from './Select.svelte';
  import Switch from './Switch.svelte';

  ensureZodMetaCompat();

  type SaveCallback = () => void | Promise<void>;
  type TestStatus = {
    ok: boolean;
    message: string;
  };
  type FieldDescriptor = {
    key: string;
    path: string;
    label: string;
    kind: 'text' | 'url' | 'password' | 'select' | 'boolean' | 'array-object';
    schema: z.ZodTypeAny;
    required: boolean;
    options?: string[];
    children?: FieldDescriptor[];
    meta: SchemaMeta;
  };

  interface Props {
    schema: z.ZodSchema;
    instanceId: string;
    currentConfig: Record<string, unknown>;
    onSaved?: SaveCallback;
  }

  let { schema, instanceId, currentConfig, onSaved }: Props = $props();

  let formValues = $state<Record<string, unknown>>({});
  let validationErrors = $state<Record<string, string>>({});
  let testStatuses = $state<Record<string, TestStatus>>({});
  let saving = $state(false);
  let saveError = $state('');
  let saveSuccess = $state(false);
  let activeTests = $state<Record<string, boolean>>({});

  const fieldDescriptors = $derived(buildObjectDescriptors(schema));

  let initializedFor = '';
  onMount(() => {
    return $effect.root(() => {
      $effect(() => {
        const signature = `${instanceId}:${JSON.stringify(currentConfig ?? {})}`;
        if (initializedFor === signature) return;
        initializedFor = signature;
        formValues = initialiseObjectValues(fieldDescriptors, currentConfig ?? {});
        validationErrors = {};
        testStatuses = {};
        saveError = '';
        saveSuccess = false;
      });
    });
  });

  function unwrapSchema(schemaValue: z.ZodTypeAny): { schema: z.ZodTypeAny; required: boolean } {
    let current = schemaValue;
    let required = true;

    while (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable ||
      current instanceof z.ZodDefault ||
      current instanceof z.ZodEffects
    ) {
      if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
        required = false;
      }

      if (current instanceof z.ZodEffects) {
        current = current._def.schema;
        continue;
      }

      current = current._def.innerType;
    }

    return { schema: current, required };
  }

  function humanizeLabel(key: string): string {
    return key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/^./, (char) => char.toUpperCase());
  }

  function buildObjectDescriptors(schemaValue: z.ZodSchema): FieldDescriptor[] {
    const { schema: unwrapped } = unwrapSchema(schemaValue as z.ZodTypeAny);
    if (!(unwrapped instanceof z.ZodObject)) {
      throw new Error('SchemaRenderer only supports object schemas');
    }

    return Object.entries(unwrapped.shape).map(([key, childSchema]) =>
      buildFieldDescriptor(key, childSchema as z.ZodTypeAny, key),
    );
  }

  function buildFieldDescriptor(key: string, schemaValue: z.ZodTypeAny, path: string): FieldDescriptor {
    const { schema: unwrapped, required } = unwrapSchema(schemaValue);
    const meta = getSchemaMeta(unwrapped);
    const label = meta.label ?? humanizeLabel(key);

    if (unwrapped instanceof z.ZodEnum) {
      return {
        key,
        path,
        label,
        kind: 'select',
        schema: unwrapped,
        required,
        options: [...unwrapped.options],
        meta,
      };
    }

    if (unwrapped instanceof z.ZodBoolean) {
      return {
        key,
        path,
        label,
        kind: 'boolean',
        schema: unwrapped,
        required,
        meta,
      };
    }

    if (unwrapped instanceof z.ZodArray) {
      const { schema: elementSchema } = unwrapSchema(unwrapped.element);
      if (!(elementSchema instanceof z.ZodObject)) {
        throw new Error(`Unsupported array schema for ${path}`);
      }

      return {
        key,
        path,
        label,
        kind: 'array-object',
        schema: unwrapped,
        required,
        children: Object.entries(elementSchema.shape).map(([childKey, childValue]) =>
          buildFieldDescriptor(childKey, childValue as z.ZodTypeAny, childKey),
        ),
        meta,
      };
    }

    if (unwrapped instanceof z.ZodString) {
      const isUrlField = unwrapped.safeParse('https://phavo.net').success;
      const kind = meta.credential ? 'password' : isUrlField ? 'url' : 'text';
      return {
        key,
        path,
        label,
        kind,
        schema: unwrapped,
        required,
        meta,
      };
    }

    throw new Error(`Unsupported schema field: ${path}`);
  }

  function deepClone<T>(value: T): T {
    return value === undefined ? value : (structuredClone(value) as T);
  }

  function createEmptyValue(descriptor: FieldDescriptor): unknown {
    if (descriptor.kind === 'boolean') return false;
    if (descriptor.kind === 'array-object') return [];
    return '';
  }

  function initialiseObjectValues(descriptors: FieldDescriptor[], source: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const descriptor of descriptors) {
      result[descriptor.key] = initialiseDescriptorValue(descriptor, source[descriptor.key], source);
    }
    return result;
  }

  function initialiseDescriptorValue(
    descriptor: FieldDescriptor,
    sourceValue: unknown,
    parentObject?: Record<string, unknown>,
  ): unknown {
    if (descriptor.kind === 'array-object') {
      if (!Array.isArray(sourceValue)) return [];

      return sourceValue.map((item) => {
        const rowSource = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const row: Record<string, unknown> = {};
        for (const child of descriptor.children ?? []) {
          row[child.key] = initialiseDescriptorValue(child, rowSource[child.key], rowSource);
        }
        return row;
      });
    }

    if (descriptor.kind === 'boolean') {
      return typeof sourceValue === 'boolean' ? sourceValue : false;
    }

    if (sourceValue !== undefined && sourceValue !== null) {
      return deepClone(sourceValue);
    }

    if (descriptor.kind === 'password') {
      const hasPersistedSibling = parentObject ? Object.keys(parentObject).length > 0 : false;
      return hasPersistedSibling ? PRESERVE_CREDENTIAL_VALUE : '';
    }

    return createEmptyValue(descriptor);
  }

  function getValueAtPath(path: string): unknown {
    const keys = path.split('.');
    let current: unknown = formValues;

    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  function setValueAtPath(path: string, value: unknown): void {
    const keys = path.split('.');
    if (keys.length === 0) return;
    const cloned = deepClone(formValues);
    let current: Record<string, unknown> = cloned;

    for (let index = 0; index < keys.length - 1; index += 1) {
      const key = keys[index];
      if (!key) continue;
      const next = current[key];
      if (!next || typeof next !== 'object') {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1];
  if (!lastKey) return;
    current[lastKey] = value;
    formValues = cloned;
    validationErrors = { ...validationErrors, [path]: '' };
    saveSuccess = false;
  }

  function updateRowField(arrayPath: string, rowIndex: number, fieldKey: string, value: unknown): void {
    const rows = getArrayRows(arrayPath).map((row) => ({ ...row }));
    const row = rows[rowIndex] ?? {};
    row[fieldKey] = value;
    rows[rowIndex] = row;
    setValueAtPath(arrayPath, rows);
  }

  function getArrayRows(path: string): Array<Record<string, unknown>> {
    const value = getValueAtPath(path);
    if (!Array.isArray(value)) return [];
    return value as Array<Record<string, unknown>>;
  }

  function createDefaultRow(children: FieldDescriptor[]): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const child of children) {
      if (child.key === 'id' && child.kind === 'text') {
        row[child.key] = crypto.randomUUID();
        continue;
      }

      row[child.key] = initialiseDescriptorValue(child, undefined, {});
    }
    return row;
  }

  function addArrayRow(path: string, children: FieldDescriptor[]): void {
    const rows = getArrayRows(path);
    setValueAtPath(path, [...rows, createDefaultRow(children)]);
  }

  function removeArrayRow(path: string, rowIndex: number): void {
    const rows = getArrayRows(path).filter((_, index) => index !== rowIndex);
    setValueAtPath(path, rows);
  }

  function getDisplayValue(value: unknown): string {
    if (typeof value === 'string') return value === PRESERVE_CREDENTIAL_VALUE ? MASKED_CREDENTIAL_DISPLAY : value;
    return '';
  }

  function resetCredential(path: string): void {
    setValueAtPath(path, '');
    const nextStatuses = { ...testStatuses };
    delete nextStatuses[path];
    testStatuses = nextStatuses;
  }

  function normalisePayloadValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => normalisePayloadValue(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, child]) => [
          key,
          normalisePayloadValue(child),
        ]),
      );
    }

    return value;
  }

  function validateField(descriptor: FieldDescriptor, path: string): void {
    const value = getValueAtPath(path);
    const candidate = value === PRESERVE_CREDENTIAL_VALUE ? 'placeholder' : value;

    if (!descriptor.required && (candidate === '' || candidate === undefined || candidate === null)) {
      validationErrors = { ...validationErrors, [path]: '' };
      return;
    }

    const result = descriptor.schema.safeParse(candidate);
    validationErrors = {
      ...validationErrors,
      [path]: result.success ? '' : result.error.issues[0]?.message ?? 'Invalid value',
    };
  }

  function handlePrimitiveInput(path: string, value: string, descriptor: FieldDescriptor): void {
    setValueAtPath(path, value);
    if (descriptor.kind === 'url') {
      validateField(descriptor, path);
    }
  }

  async function handleTest(path: string, testEndpoint: string): Promise<void> {
    activeTests = { ...activeTests, [path]: true };
    testStatuses = { ...testStatuses, [path]: undefined as never };

    try {
      const response = await fetch(testEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalisePayloadValue(formValues)),
      });
      const payload = (await response.json()) as { ok: boolean; data?: { connected?: boolean; version?: string }; error?: string };
      if (!payload.ok) {
        testStatuses = {
          ...testStatuses,
          [path]: { ok: false, message: payload.error ?? 'Test failed' },
        };
        return;
      }

      const message = payload.data?.connected
        ? payload.data.version
          ? `Connected${payload.data.version ? ` · ${payload.data.version}` : ''}`
          : 'Connected'
        : 'Connection failed';

      testStatuses = {
        ...testStatuses,
        [path]: { ok: payload.data?.connected !== false, message },
      };
    } catch {
      testStatuses = {
        ...testStatuses,
        [path]: { ok: false, message: 'Connection failed' },
      };
    } finally {
      activeTests = { ...activeTests, [path]: false };
    }
  }

  async function saveConfig(): Promise<void> {
    saving = true;
    saveError = '';
    saveSuccess = false;

    try {
      const response = await fetch(`/api/v1/widgets/${encodeURIComponent(instanceId)}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: normalisePayloadValue(formValues) }),
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!payload.ok) {
        throw new Error(payload.error ?? 'Failed to save widget config');
      }

      saveSuccess = true;
      await onSaved?.();
    } catch (error) {
      saveError = error instanceof Error ? error.message : 'Failed to save widget config';
    } finally {
      saving = false;
    }
  }

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    await saveConfig();
  }
</script>

<form class="schema-renderer" onsubmit={handleSubmit}>
  {#snippet renderFields(descriptors: FieldDescriptor[], parentPath = '')}
    {#each descriptors as descriptor (descriptor.path)}
      {@const path = parentPath ? `${parentPath}.${descriptor.key}` : descriptor.key}
      {@const value = getValueAtPath(path)}
      {@const hasError = validationErrors[path] ?? ''}
      <div class="field-block field-{descriptor.kind}">
        {#if descriptor.kind === 'text' || descriptor.kind === 'url' || descriptor.kind === 'password'}
          <div class="field-row">
            <Input
              label={descriptor.label}
              type={descriptor.kind === 'password' ? 'password' : descriptor.kind === 'url' ? 'url' : 'text'}
              value={getDisplayValue(value)}
              error={hasError}
              oninput={(event) =>
                handlePrimitiveInput(
                  path,
                  (event.currentTarget as HTMLInputElement).value,
                  descriptor,
                )}
            />
            {#if descriptor.meta.testEndpoint}
              <Button
                variant="secondary"
                onclick={() => handleTest(path, descriptor.meta.testEndpoint!)}
                disabled={!!activeTests[path]}
              >
                {activeTests[path] ? 'Testing...' : 'Test'}
              </Button>
            {/if}
            {#if descriptor.kind === 'password' && value === PRESERVE_CREDENTIAL_VALUE}
              <Button variant="ghost" onclick={() => resetCredential(path)}>Reset</Button>
            {/if}
          </div>
          {#if descriptor.kind === 'url' && value}
            <span class:field-valid={!hasError} class:field-invalid={!!hasError} class="field-hint">
              {hasError ? '✗ Invalid URL' : '✓ Valid URL'}
            </span>
          {/if}
          {#if testStatuses[path]}
            <span
              class:field-valid={testStatuses[path].ok}
              class:field-invalid={!testStatuses[path].ok}
              class="field-hint"
            >
              {testStatuses[path].ok ? '✓' : '✗'} {testStatuses[path].message}
            </span>
          {/if}
        {:else if descriptor.kind === 'select'}
          <Select
            label={descriptor.label}
            options={(descriptor.options ?? []).map((option) => ({ value: option, label: option }))}
            value={typeof value === 'string' ? value : descriptor.options?.[0] ?? ''}
            onchange={(nextValue) => setValueAtPath(path, nextValue)}
          />
        {:else if descriptor.kind === 'boolean'}
          <div class="toggle-row">
            <span class="toggle-label">{descriptor.label}</span>
            <Switch
              checked={Boolean(value)}
              onchange={(nextValue) => setValueAtPath(path, nextValue)}
            />
          </div>
        {:else if descriptor.kind === 'array-object'}
          <div class="array-section">
            <div class="array-header">
              <div>
                <span class="array-title">{descriptor.label}</span>
                <span class="array-subtitle">Add or remove rows as needed.</span>
              </div>
              <Button variant="secondary" onclick={() => addArrayRow(path, descriptor.children ?? [])}>
                Add row
              </Button>
            </div>
            <div class="array-rows">
              {#each getArrayRows(path) as row, rowIndex (String((row as { id?: string }).id ?? rowIndex))}
                <div class="array-row-card">
                  <div class="array-row-actions">
                    <span class="array-row-title">Row {rowIndex + 1}</span>
                    <Button variant="ghost" onclick={() => removeArrayRow(path, rowIndex)}>Remove</Button>
                  </div>
                  {@render renderFields(descriptor.children ?? [], `${path}.${rowIndex}`)}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  {/snippet}

  {@render renderFields(fieldDescriptors)}

  {#if saveError}
    <p class="save-message save-error">{saveError}</p>
  {/if}
  {#if saveSuccess}
    <p class="save-message save-success">Saved.</p>
  {/if}

  <div class="save-actions">
    <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save widget settings'}</Button>
  </div>
</form>

<style>
  .schema-renderer {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .field-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .field-row {
    display: grid;
    gap: var(--space-3);
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: end;
  }

  .field-hint {
    font-size: 12px;
  }

  .field-valid {
    color: var(--color-success, #68b984);
  }

  .field-invalid {
    color: var(--color-danger);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-3);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-bg-base);
  }

  .toggle-label {
    font-size: 14px;
    color: var(--color-text-primary);
  }

  .array-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .array-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .array-title {
    display: block;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .array-subtitle {
    display: block;
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .array-rows {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .array-row-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-4);
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-bg-surface);
  }

  .array-row-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .array-row-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .save-actions {
    display: flex;
    justify-content: flex-start;
  }

  .save-message {
    font-size: 13px;
  }

  .save-error {
    color: var(--color-danger);
  }

  .save-success {
    color: var(--color-success, #68b984);
  }

  @media (max-width: 640px) {
    .field-row,
    .array-header,
    .array-row-actions {
      grid-template-columns: 1fr;
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }

    .toggle-row {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>