-- Migration 0007: Remove tier system (open-source migration)
-- Drops tier column from sessions and drops license_activation table entirely.
-- Note: ALTER TABLE ... RENAME TO triggers a libsql SQLITE_OK false-error,
-- so we use DROP TABLE + CREATE TABLE instead of the typical rename approach.

-- ── 1. Copy sessions data into a temp table without tier ─────────────────────
CREATE TABLE `sessions_new` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `auth_mode` text NOT NULL,
  `validated_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `sessions_new` (`id`, `user_id`, `auth_mode`, `validated_at`, `expires_at`)
SELECT `id`, `user_id`, `auth_mode`, `validated_at`, `expires_at`
FROM `sessions`;
--> statement-breakpoint
DROP TABLE `sessions`;
--> statement-breakpoint
-- ── 2. Recreate sessions with the correct schema ─────────────────────────────
CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `auth_mode` text NOT NULL,
  `validated_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `sessions` (`id`, `user_id`, `auth_mode`, `validated_at`, `expires_at`)
SELECT `id`, `user_id`, `auth_mode`, `validated_at`, `expires_at`
FROM `sessions_new`;
--> statement-breakpoint
DROP TABLE `sessions_new`;
--> statement-breakpoint
-- ── 3. Drop license_activation table ─────────────────────────────────────────
DROP TABLE IF EXISTS `license_activation`;
