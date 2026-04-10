-- Migration: add plugin_data table for widget persistent storage
CREATE TABLE IF NOT EXISTS `plugin_data` (
  `id`         TEXT PRIMARY KEY NOT NULL,
  `widget_id`  TEXT NOT NULL,
  `key`        TEXT NOT NULL,
  `value`      TEXT NOT NULL,
  `updated_at` INTEGER DEFAULT (unixepoch()) NOT NULL,
  UNIQUE(`widget_id`, `key`)
);
