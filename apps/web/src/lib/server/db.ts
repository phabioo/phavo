import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createDb, runMigrations } from '@phavo/db';
import { building } from '$app/environment';
import { paths } from './paths.js';

// Ensure the data directory exists before opening the database.
mkdirSync(dirname(paths.db), { recursive: true });

export const db = createDb(`file:${paths.db}`);

/**
 * Resolves once migrations have run successfully.
 * Await this before the first DB query to ensure the schema exists.
 * Migration files: packages/db/src/migrations/
 */
export const dbReady: Promise<void> = building
  ? Promise.resolve()
  : runMigrations(db).catch((err: unknown) => {
      console.error('[phavo] DB migration failed — cannot start:', err);
      process.exit(1);
    });
