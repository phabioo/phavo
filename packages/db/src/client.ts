import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { env } from '@phavo/types/env';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema.js';

export function createDb(url = `file:${env.dbPath}`) {
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Run all pending migrations. Safe to call multiple times (idempotent).
 *  PHAVO_MIGRATIONS_DIR overrides the default source-relative path so that
 *  the Docker production image can point to the copied SQL files. */
export async function runMigrations(db: Db): Promise<void> {
  const migrationsFolder =
    process.env.PHAVO_MIGRATIONS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  await migrate(db, { migrationsFolder });
}
