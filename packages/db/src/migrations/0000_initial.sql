CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text,
  `password_hash` text,
  `auth_mode` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `tier` text NOT NULL,
  `auth_mode` text NOT NULL,
  `validated_at` integer NOT NULL,
  `grace_until` integer,
  `expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `config` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL,
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `tabs` (
  `id` text PRIMARY KEY NOT NULL,
  `label` text NOT NULL,
  `order` integer NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `widget_instances` (
  `id` text PRIMARY KEY NOT NULL,
  `widget_id` text NOT NULL,
  `tab_id` text NOT NULL REFERENCES `tabs`(`id`),
  `size` text NOT NULL,
  `position_x` integer NOT NULL,
  `position_y` integer NOT NULL,
  `config_encrypted` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `credentials` (
  `id` text PRIMARY KEY NOT NULL,
  `key` text NOT NULL UNIQUE,
  `value_encrypted` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `license_activation` (
  `id` text PRIMARY KEY NOT NULL,
  `license_key` text NOT NULL,
  `tier` text NOT NULL,
  `activated_at` integer NOT NULL DEFAULT (unixepoch()),
  `instance_identifier` text NOT NULL
);

CREATE TABLE `widget_instances` (
  `id` text PRIMARY KEY NOT NULL,
  `widget_id` text NOT NULL,
  `tab_id` text NOT NULL REFERENCES `tabs`(`id`),
  `size` text NOT NULL,
  `position_x` integer NOT NULL,
  `position_y` integer NOT NULL,
  `config_encrypted` text,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE `credentials` (
  `id` text PRIMARY KEY NOT NULL,
  `key` text NOT NULL UNIQUE,
  `value_encrypted` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  `updated_at` integer NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE `license_activation` (
  `id` text PRIMARY KEY NOT NULL,
  `license_key` text NOT NULL,
  `tier` text NOT NULL,
  `activated_at` integer NOT NULL DEFAULT (unixepoch()),
  `instance_identifier` text NOT NULL
);
