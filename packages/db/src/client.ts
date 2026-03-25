import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema';

export function createDb(url = 'file:/data/phavo.db') {
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Run all pending migrations. Safe to call multiple times (idempotent). */
export async function runMigrations(db: Db): Promise<void> {
  const migrationsFolder = join(
    dirname(fileURLToPath(import.meta.url)),
    'migrations',
  );
  await migrate(db, { migrationsFolder });
}
