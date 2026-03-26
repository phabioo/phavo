import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { env } from '@phavo/types/env';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './schema';

export function createDb(url = `file:${env.dbPath}`) {
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Run all pending migrations. Safe to call multiple times (idempotent). */
export async function runMigrations(db: Db): Promise<void> {
  const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
  await migrate(db, { migrationsFolder });
}
