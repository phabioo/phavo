-- Migration 0009: Repair sessions table on DBs where 0007 did not apply correctly.
-- 0007 originally lacked --> statement-breakpoint markers so only its first
-- statement ran (CREATE TABLE sessions_new). DROP TABLE sessions and the
-- rename were never executed, leaving the sessions table with legacy tier NOT NULL.
-- This migration is safe on both affected and unaffected DBs.
-- Uses DROP TABLE + CREATE TABLE to avoid the libsql RENAME TO false-error.

DROP TABLE IF EXISTS `sessions_new`;
--> statement-breakpoint
CREATE TABLE `sessions_2` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `auth_mode` text NOT NULL,
  `validated_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `sessions_2` (`id`, `user_id`, `auth_mode`, `validated_at`, `expires_at`)
SELECT `id`, `user_id`, `auth_mode`, `validated_at`, `expires_at`
FROM `sessions`;
--> statement-breakpoint
DROP TABLE `sessions`;
--> statement-breakpoint
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
FROM `sessions_2`;
--> statement-breakpoint
DROP TABLE `sessions_2`;
