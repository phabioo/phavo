import { createDb, runMigrations } from '@phavo/db';
import { mkdirSync } from 'fs';
import { resolve } from 'path';

const dataDir = resolve(process.env.PHAVO_DATA_DIR ?? '/data');
mkdirSync(dataDir, { recursive: true });

export const db = createDb(`file:${dataDir}/phavo.db`);

/**
 * Resolves once migrations have run (or have failed — check server logs).
 * Await this before the first DB query to ensure the schema exists.
 * Migration files: packages/db/src/migrations/
 */
export const dbReady: Promise<void> = runMigrations(db).catch((err: unknown) => {
  console.error('[phavo] DB migration failed — schema may be missing:', err);
});
