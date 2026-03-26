import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// All timestamps stored as Unix milliseconds (integer).
// Use Date.now() when writing; read as raw number.
const nowMs = sql`(unixepoch() * 1000)`;

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // Unique when present; multiple NULLs are allowed in SQLite UNIQUE constraints.
  email: text('email').unique(),
  // Argon2id hash. Local users only. Never stored for phavo.io users.
  passwordHash: text('password_hash'),
  authMode: text('auth_mode', { enum: ['phavo-io', 'local'] }).notNull(),
  // AES-256-GCM encrypted. Set only when user enables 2FA.
  totpSecret: text('totp_secret'),
  // JSON array, AES-256-GCM encrypted. 8 one-time backup codes.
  totpBackupCodes: text('totp_backup_codes'),
  createdAt: integer('created_at').notNull().default(nowMs),
});

export const sessions = sqliteTable('sessions', {
  // 32-byte random base64url token — this is the cookie value itself.
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  // Single source of truth for tier enforcement. Set by server on login only.
  tier: text('tier', { enum: ['free', 'standard', 'local'] }).notNull(),
  authMode: text('auth_mode', { enum: ['phavo-io', 'local'] }).notNull(),
  // Unix ms. Last successful phavo.io validation.
  validatedAt: integer('validated_at').notNull(),
  // Unix ms. Session valid offline until this time. Null for local tier.
  graceUntil: integer('grace_until'),
  // Unix ms. Hard expiry — 7 days from creation.
  expiresAt: integer('expires_at').notNull(),
});

export const config = sqliteTable('config', {
  // e.g. 'dashboardName', 'location', 'setupComplete', 'installMethod'
  key: text('key').primaryKey(),
  // JSON-serialised value. No 'tier' key — see arch spec "Tier enforcement rule".
  value: text('value').notNull(),
  // timestamp_ms: Drizzle stores Unix ms, accepts Date objects on insert/update.
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
});

export const tabs = sqliteTable('tabs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  label: text('label').notNull(),
  // 0-indexed sort order.
  order: integer('order').notNull(),
  createdAt: integer('created_at').notNull().default(nowMs),
});

export const widgetInstances = sqliteTable('widget_instances', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // References WidgetDefinition.id — not a DB FK since registry is in-memory.
  widgetId: text('widget_id').notNull(),
  tabId: text('tab_id')
    .notNull()
    .references(() => tabs.id),
  size: text('size', { enum: ['S', 'M', 'L', 'XL'] }).notNull(),
  // Grid column (0–11).
  positionX: integer('position_x').notNull(),
  positionY: integer('position_y').notNull(),
  // AES-256-GCM. JSON object with non-credential widget config.
  configEncrypted: text('config_encrypted'),
  createdAt: integer('created_at').notNull().default(nowMs),
  // timestamp_ms: Drizzle stores Unix ms, accepts Date objects on insert/update.
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().default(nowMs),
});

export const credentials = sqliteTable('credentials', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // Unique key, e.g. 'pihole_token', 'rss_feed_1_auth'.
  key: text('key').notNull().unique(),
  // AES-256-GCM. base64(iv + authTag + ciphertext).
  valueEncrypted: text('value_encrypted').notNull(),
  createdAt: integer('created_at').notNull().default(nowMs),
  updatedAt: integer('updated_at').notNull().default(nowMs),
});

export const licenseActivation = sqliteTable('license_activation', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // Gumroad licence key.
  licenseKey: text('license_key').notNull(),
  // Only 'local' tier activates here — see arch spec.
  tier: text('tier', { enum: ['local'] }).notNull(),
  // RS256-signed JWT from phavo.io. Payload: { instanceId, tier, activatedAt }.
  activationJwt: text('activation_jwt').notNull(),
  // Stable UUID bound to Docker volume (generated once, stored in instance.id).
  instanceIdentifier: text('instance_identifier').notNull(),
  activatedAt: integer('activated_at').notNull().default(nowMs),
});
