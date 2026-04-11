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
  // Argon2id hash. Local users only.
  passwordHash: text('password_hash'),
  authMode: text('auth_mode', { enum: ['local'] }).notNull(),
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
  authMode: text('auth_mode', { enum: ['local'] }).notNull(),
  // Unix ms. Last successful local auth.
  validatedAt: integer('validated_at').notNull(),
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
  // Tracks which version of the widget's configSchema was used to create this config.
  configSchemaVersion: integer('config_schema_version').notNull().default(1),
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

export const pluginData = sqliteTable('plugin_data', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  widgetId: text('widget_id').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`),
});

export const notifications = sqliteTable('notifications', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  // 'update' | 'security' | 'widget-error' | 'task' | 'info'
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: integer('read').notNull().default(0),
  // Optional CTA button label.
  actionLabel: text('action_label'),
  // Optional CTA target URL.
  actionUrl: text('action_url'),
  // For widget-error deep-links.
  widgetId: text('widget_id'),
  // 0–100 for task type, null otherwise.
  progress: integer('progress'),
  createdAt: integer('created_at').notNull().default(nowMs),
});
