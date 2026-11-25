CREATE TABLE `auth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_accounts_user_idx` ON `auth_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `auth_accounts_provider_account_uq` ON `auth_accounts` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_rate_limits_key_unique` ON `auth_rate_limits` (`key`);--> statement-breakpoint
CREATE TABLE `auth_two_factors` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`verified` integer DEFAULT true,
	`failed_verification_count` integer DEFAULT 0,
	`locked_until` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_two_factors_user_idx` ON `auth_two_factors` (`user_id`);--> statement-breakpoint
CREATE INDEX `auth_two_factors_secret_idx` ON `auth_two_factors` (`secret`);--> statement-breakpoint
CREATE TABLE `auth_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_verifications_identifier_idx` ON `auth_verifications` (`identifier`);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_token_unique` ON `user_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `user_sessions_user_idx` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "users_status_check" CHECK(status in ('active', 'suspended'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`responded_at` integer,
	`responded_by_user_id` text,
	`delivery_status` text DEFAULT 'pending' NOT NULL,
	`delivery_error` text,
	`send_count` integer DEFAULT 0 NOT NULL,
	`last_sent_at` integer,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invitations_role_check" CHECK(role in ('owner', 'admin', 'manager', 'member', 'viewer')),
	CONSTRAINT "invitations_status_check" CHECK(status in ('pending', 'accepted', 'rejected', 'revoked', 'expired')),
	CONSTRAINT "invitations_delivery_check" CHECK(delivery_status in ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_hash_unique` ON `invitations` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_one_pending_uq` ON `invitations` (`organization_id`,`email`) WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX `invitations_org_idx` ON `invitations` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `organization_members` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`deactivated_at` integer,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "organization_members_role_check" CHECK(role in ('owner', 'admin', 'manager', 'member', 'viewer')),
	CONSTRAINT "organization_members_status_check" CHECK(status in ('active', 'deactivated'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_members_org_user_uq` ON `organization_members` (`organization_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `organization_members_user_idx` ON `organization_members` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`timezone` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`suspended_at` integer,
	`suspended_reason` text,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "organizations_status_check" CHECK(status in ('active', 'suspended', 'deleted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizations_slug_unique` ON `organizations` (`slug`);--> statement-breakpoint
CREATE TABLE `domain_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`method` text NOT NULL,
	`record_name` text NOT NULL,
	`record_value` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_checked_at` integer,
	`last_error_code` text,
	`verified_at` integer,
	`expires_at` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`domain_id`,`website_id`,`organization_id`) REFERENCES `website_domains`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "domain_verifications_status_check" CHECK(status in ('pending', 'verified', 'expired', 'superseded')),
	CONSTRAINT "domain_verifications_method_check" CHECK(method in ('dns_txt'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domain_verifications_one_pending_uq` ON `domain_verifications` (`domain_id`) WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX `domain_verifications_domain_idx` ON `domain_verifications` (`domain_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `website_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`host` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`verified_at` integer,
	`created_by_user_id` text NOT NULL,
	`retired_at` integer,
	`retired_reason` text,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`website_id`,`organization_id`) REFERENCES `websites`(`id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "website_domains_kind_check" CHECK(kind in ('canonical', 'alias', 'redirect')),
	CONSTRAINT "website_domains_status_check" CHECK(status in ('active', 'retired')),
	CONSTRAINT "website_domains_verification_check" CHECK(verification_status in ('unverified', 'pending', 'verified'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `website_domains_id_website_org_uq` ON `website_domains` (`id`,`website_id`,`organization_id`);--> statement-breakpoint
CREATE INDEX `website_domains_website_idx` ON `website_domains` (`website_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `website_domains_one_canonical_uq` ON `website_domains` (`website_id`) WHERE kind = 'canonical' and status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `website_domains_org_host_uq` ON `website_domains` (`organization_id`,`host`) WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX `website_domains_verified_host_uq` ON `website_domains` (`host`) WHERE status = 'active' and verification_status = 'verified';--> statement-breakpoint
CREATE TABLE `websites` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`name` text NOT NULL,
	`site_type` text NOT NULL,
	`business_category` text,
	`business_description` text,
	`market` text NOT NULL,
	`language` text NOT NULL,
	`timezone` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`status_before_archive` text,
	`created_by_user_id` text NOT NULL,
	`activated_at` integer,
	`paused_at` integer,
	`archived_at` integer,
	`removed_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "websites_status_check" CHECK(status in ('draft', 'active', 'paused', 'archived', 'removed')),
	CONSTRAINT "websites_site_type_check" CHECK(site_type in ('shopify', 'woocommerce', 'wordpress', 'webflow', 'wix', 'squarespace', 'custom', 'manual'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `websites_id_org_uq` ON `websites` (`id`,`organization_id`);--> statement-breakpoint
CREATE INDEX `websites_org_status_idx` ON `websites` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `organization_entitlements` (
	`organization_id` text PRIMARY KEY NOT NULL,
	`max_websites` integer NOT NULL,
	`max_members` integer NOT NULL,
	`max_active_prompts` integer NOT NULL,
	`monthly_ai_requests` integer NOT NULL,
	`monthly_search_calls` integer NOT NULL,
	`source` text DEFAULT 'default' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entitlements_non_negative_check" CHECK(max_websites >= 0 and max_members >= 1 and max_active_prompts >= 0 and monthly_ai_requests >= 0 and monthly_search_calls >= 0),
	CONSTRAINT "entitlements_source_check" CHECK(source in ('default', 'manual', 'plan'))
);
--> statement-breakpoint
CREATE TABLE `usage_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text,
	`reservation_id` text,
	`actor_type` text NOT NULL,
	`actor_user_id` text,
	`provider` text,
	`model` text,
	`run_id` text,
	`request_id` text,
	`usage_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`estimated_cost_micros` integer,
	`actual_cost_micros` integer,
	`currency` text,
	`period` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reservation_id`) REFERENCES `usage_reservations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`website_id`,`organization_id`) REFERENCES `websites`(`id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "usage_ledger_quantity_check" CHECK(quantity >= 0),
	CONSTRAINT "usage_ledger_type_check" CHECK(usage_type in ('ai_request', 'search_call')),
	CONSTRAINT "usage_ledger_actor_check" CHECK(actor_type in ('user', 'system'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_ledger_org_key_uq` ON `usage_ledger` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `usage_ledger_org_period_idx` ON `usage_ledger` (`organization_id`,`usage_type`,`period`);--> statement-breakpoint
CREATE TABLE `usage_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text,
	`metric` text NOT NULL,
	`quantity` integer NOT NULL,
	`period` text NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`settled_quantity` integer,
	`idempotency_key` text NOT NULL,
	`run_ref` text,
	`created_by_user_id` text,
	`expires_at` integer NOT NULL,
	`closed_at` integer,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`website_id`,`organization_id`) REFERENCES `websites`(`id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "usage_reservations_quantity_check" CHECK(quantity > 0),
	CONSTRAINT "usage_reservations_metric_check" CHECK(metric in ('ai_request', 'search_call')),
	CONSTRAINT "usage_reservations_status_check" CHECK(status in ('reserved', 'settled', 'released'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_reservations_org_key_uq` ON `usage_reservations` (`organization_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `usage_reservations_quota_idx` ON `usage_reservations` (`organization_id`,`metric`,`period`,`status`);--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text,
	`actor_type` text NOT NULL,
	`actor_user_id` text,
	`actor_name` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`metadata` text,
	`request_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`website_id`,`organization_id`) REFERENCES `websites`(`id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "activity_logs_actor_check" CHECK(actor_type in ('user', 'system'))
);
--> statement-breakpoint
CREATE INDEX `activity_logs_org_idx` ON `activity_logs` (`organization_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `activity_logs_website_idx` ON `activity_logs` (`website_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `idempotency_records` (
	`user_id` text NOT NULL,
	`route` text NOT NULL,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text NOT NULL,
	`response_status` integer,
	`response_body` text,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_records_uq` ON `idempotency_records` (`user_id`,`route`,`key`);--> statement-breakpoint
CREATE INDEX `idempotency_records_expiry_idx` ON `idempotency_records` (`expires_at`);--> statement-breakpoint
CREATE TABLE `security_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text,
	`user_id` text,
	`event` text NOT NULL,
	`outcome` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`metadata` text,
	`request_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	CONSTRAINT "security_audit_logs_outcome_check" CHECK(outcome in ('success', 'failure', 'denied'))
);
--> statement-breakpoint
CREATE INDEX `security_audit_logs_org_idx` ON `security_audit_logs` (`organization_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `security_audit_logs_user_idx` ON `security_audit_logs` (`user_id`,`created_at`);