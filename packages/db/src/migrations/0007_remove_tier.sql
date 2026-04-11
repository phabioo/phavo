-- Migration 0007: Remove tier system (open-source migration)
-- Drops tier column from sessions and drops license_activation table entirely.

-- ── 1. Recreate sessions without tier column ─────────────────────────────────
CREATE TABLE `sessions_new` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `auth_mode` text NOT NULL,
  `validated_at` integer NOT NULL,
  `expires_at` integer NOT NULL
);

INSERT INTO `sessions_new` (`id`, `user_id`, `auth_mode`, `validated_at`, `expires_at`)
SELECT `id`, `user_id`, `auth_mode`, `validated_at`, `expires_at`
FROM `sessions`;

DROP TABLE `sessions`;

ALTER TABLE `sessions_new` RENAME TO `sessions`;

-- ── 2. Drop license_activation table ─────────────────────────────────────────
DROP TABLE IF EXISTS `license_activation`;
