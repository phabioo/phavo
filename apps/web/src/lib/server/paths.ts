// apps/web/src/lib/server/paths.ts — single source of truth for all file paths.
// All server file accesses must go through this object.
// Never construct paths manually anywhere else in the codebase.

import path from 'node:path';
import { env } from '@phavo/types/env';

export const paths = {
  db: env.dbPath,
  encKey: path.join(env.dataDir, 'secret.key'),
  instanceId: path.join(env.dataDir, 'instance.id'),
  certs: path.join(env.dataDir, 'certs'),
  plugins: path.join(env.dataDir, 'plugins'),
} as const;
