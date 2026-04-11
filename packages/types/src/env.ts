// packages/types/src/env.ts — single source of truth for all environment variables.
// All server code must read paths and ports from this object.
// Iron rule: never use '/data/' as a literal anywhere in packages/ or apps/web/src/lib/server/.

import { homedir } from 'node:os';
import { join } from 'node:path';

export type PhavoEnv = 'docker' | 'bun' | 'tauri';

export type InstallMethod = 'docker-compose' | 'docker-run' | 'bun-direct' | 'tauri';

const platform = (process.env.PHAVO_ENV ?? 'docker') as PhavoEnv;
const defaultDataDir = platform === 'docker' ? '/data' : join(homedir(), '.phavo', 'data');
const dataDir = process.env.PHAVO_DATA_DIR ?? defaultDataDir;

export const env = {
  dataDir,
  dbPath: process.env.PHAVO_DB_PATH ?? join(dataDir, 'phavo.db'),
  port: Number(process.env.PHAVO_PORT ?? 3000),
  httpsPort: Number(process.env.PHAVO_HTTPS_PORT ?? 3443),
  platform,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  trustProxy: process.env.PHAVO_TRUST_PROXY === 'true',
} as const;
