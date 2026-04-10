UPDATE `users` SET `auth_mode` = 'local'
WHERE `auth_mode` <> 'local';
--> statement-breakpoint
UPDATE `sessions` SET `auth_mode` = 'local'
WHERE `auth_mode` <> 'local';
--> statement-breakpoint
CREATE TABLE `sessions_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tier` text NOT NULL,
	`auth_mode` text NOT NULL,
	`validated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `sessions_new` (`id`, `user_id`, `tier`, `auth_mode`, `validated_at`, `expires_at`)
SELECT `id`, `user_id`, `tier`, `auth_mode`, `validated_at`, `expires_at`
FROM `sessions`;
--> statement-breakpoint
DROP TABLE `sessions`;
--> statement-breakpoint
ALTER TABLE `sessions_new` RENAME TO `sessions`;
--> statement-breakpoint
CREATE TABLE `license_activation_new` (
	`id` text PRIMARY KEY NOT NULL,
	`tier` text NOT NULL,
	`license_id` text NOT NULL,
	`issued_at` text NOT NULL,
	`payload_b64` text NOT NULL,
	`signature_b64` text NOT NULL,
	`activated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `license_activation_new` (`id`, `tier`, `license_id`, `issued_at`, `payload_b64`, `signature_b64`, `activated_at`)
SELECT
	`id`,
	`tier`,
	`id`,
	CAST(`activated_at` AS text),
	COALESCE(`activation_jwt`, ''),
	'',
	`activated_at`
FROM `license_activation`;
--> statement-breakpoint
DROP TABLE `license_activation`;
--> statement-breakpoint
ALTER TABLE `license_activation_new` RENAME TO `license_activation`;
