import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email'),
  passwordHash: text('password_hash'),
  authMode: text('auth_mode', { enum: ['phavio-io', 'local'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const sessions = sqliteTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  tier: text('tier', { enum: ['free', 'standard', 'local'] }).notNull(),
  authMode: text('auth_mode', { enum: ['phavio-io', 'local'] }).notNull(),
  validatedAt: integer('validated_at').notNull(),
  graceUntil: integer('grace_until'),
  expiresAt: integer('expires_at').notNull(),
});

export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const tabs = sqliteTable('tabs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  label: text('label').notNull(),
  order: integer('order').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const widgetInstances = sqliteTable('widget_instances', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  widgetId: text('widget_id').notNull(),
  tabId: text('tab_id')
    .notNull()
    .references(() => tabs.id),
  size: text('size', { enum: ['S', 'M', 'L', 'XL'] }).notNull(),
  positionX: integer('position_x').notNull(),
  positionY: integer('position_y').notNull(),
  configEncrypted: text('config_encrypted'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const credentials = sqliteTable('credentials', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  valueEncrypted: text('value_encrypted').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const licenseActivation = sqliteTable('license_activation', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  licenseKey: text('license_key').notNull(),
  tier: text('tier', { enum: ['free', 'standard', 'local'] }).notNull(),
  activatedAt: integer('activated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  instanceIdentifier: text('instance_identifier').notNull(),
});
