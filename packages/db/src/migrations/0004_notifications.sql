CREATE TABLE IF NOT EXISTS `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`read` integer DEFAULT 0 NOT NULL,
	`action_label` text,
	`action_url` text,
	`widget_id` text,
	`progress` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
