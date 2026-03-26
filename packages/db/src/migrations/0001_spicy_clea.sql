CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value_encrypted` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credentials_key_unique` ON `credentials` (`key`);--> statement-breakpoint
CREATE TABLE `license_activation` (
	`id` text PRIMARY KEY NOT NULL,
	`license_key` text NOT NULL,
	`tier` text NOT NULL,
	`activation_jwt` text NOT NULL,
	`instance_identifier` text NOT NULL,
	`activated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tier` text NOT NULL,
	`auth_mode` text NOT NULL,
	`validated_at` integer NOT NULL,
	`grace_until` integer,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tabs` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`order` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`password_hash` text,
	`auth_mode` text NOT NULL,
	`totp_secret` text,
	`totp_backup_codes` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `widget_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`widget_id` text NOT NULL,
	`tab_id` text NOT NULL,
	`size` text NOT NULL,
	`position_x` integer NOT NULL,
	`position_y` integer NOT NULL,
	`config_encrypted` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`tab_id`) REFERENCES `tabs`(`id`) ON UPDATE no action ON DELETE no action
);
