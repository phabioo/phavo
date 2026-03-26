<script lang="ts">
  import { Card } from '@phavo/ui';
  import en from '$lib/i18n/en.json';
</script>

<Card padding="none">
  <div class="import-export-tab">
    <h2>{en.settings.importExport}</h2>
    <p>{en.settings.importExportPending}</p>
  </div>
</Card>

<style>
  .import-export-tab {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-5);
  }

  h2 {
    color: var(--color-text-primary);
    font-size: 1rem;
    margin: 0;
  }

  p {
    color: var(--color-text-secondary);
    margin: 0;
  }
</style>