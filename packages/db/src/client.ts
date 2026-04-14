import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { env } from '@phavo/types/env';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

export function createDb(url = `file:${env.dbPath}`) {
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

/**
 * Custom migration runner using client.executeMultiple() (the db.exec path).
 * Drizzle's built-in migrate() uses executeStmt (prepare().run()) which triggers
 * a SQLITE_OK false-error in @libsql/client for DDL statements inside transactions.
 * executeMultiple calls db.exec() directly and handles DDL correctly.
 */
export async function runMigrations(db: Db): Promise<void> {
  const migrationsFolder =
    process.env.PHAVO_MIGRATIONS_DIR ?? join(dirname(fileURLToPath(import.meta.url)), 'migrations');

  const client = db.$client;

  // Ensure the migrations tracking table exists.
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    )
  `);

  // Find the timestamp of the last applied migration.
  const result = await client.execute(
    'SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1',
  );
  const lastAppliedAt: number = result.rows[0] ? Number(result.rows[0][0]) : 0;

  // Read the Drizzle journal to get the ordered list of migration files.
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf-8'),
  ) as { entries: JournalEntry[] };

  for (const entry of journal.entries) {
    if (entry.when <= lastAppliedAt) continue;

    const sql = readFileSync(join(migrationsFolder, `${entry.tag}.sql`), 'utf-8');

    // Strip Drizzle's statement-breakpoint markers — db.exec handles multiple
    // semicolon-separated statements natively without needing them.
    const cleanSql = sql.replace(/--> statement-breakpoint/g, '');

    await client.executeMultiple(cleanSql);

    await client.execute({
      sql: 'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      args: [entry.tag, entry.when],
    });
  }
}
