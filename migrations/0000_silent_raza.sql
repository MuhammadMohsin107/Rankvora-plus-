CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`schema_version` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
