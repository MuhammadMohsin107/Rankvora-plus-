CREATE TABLE `domain_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`domain_id` text NOT NULL,
	`https_ok` integer NOT NULL,
	`http_upgrades` integer,
	`final_url` text,
	`final_status` integer,
	`leaves_website` integer,
	`redirects` text NOT NULL,
	`error_code` text,
	`checked_by_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`domain_id`,`website_id`,`organization_id`) REFERENCES `website_domains`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `domain_checks_domain_idx` ON `domain_checks` (`domain_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `brand_fact_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`fact_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`note` text,
	`added_by_user_id` text NOT NULL,
	`removed_at` integer,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`fact_id`,`website_id`,`organization_id`) REFERENCES `brand_facts`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brand_fact_sources_url_uq` ON `brand_fact_sources` (`fact_id`,`url`) WHERE removed_at is null;--> statement-breakpoint
CREATE TABLE `brand_fact_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`fact_id` text NOT NULL,
	`version` integer NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`status` text NOT NULL,
	`verification_basis` text,
	`note` text,
	`changed_by_user_id` text NOT NULL,
	`changed_by_name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`fact_id`,`website_id`,`organization_id`) REFERENCES `brand_facts`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brand_fact_versions_number_uq` ON `brand_fact_versions` (`fact_id`,`version`);--> statement-breakpoint
CREATE TABLE `brand_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`kind` text NOT NULL,
	`product_id` text,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`status` text DEFAULT 'unverified' NOT NULL,
	`origin` text NOT NULL,
	`verification_basis` text,
	`last_verified_at` integer,
	`last_verified_by_name` text,
	`removed_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`website_id`,`organization_id`) REFERENCES `websites`(`id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`,`website_id`,`organization_id`) REFERENCES `products_services`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "brand_facts_kind_check" CHECK(kind in ('business', 'product', 'faq')),
	CONSTRAINT "brand_facts_status_check" CHECK(status in ('unverified', 'verified', 'contradicted', 'outdated', 'needs_review')),
	CONSTRAINT "brand_facts_origin_check" CHECK(origin in ('owner', 'website', 'imported', 'generated')),
	CONSTRAINT "brand_facts_basis_check" CHECK((status = 'verified') = (verification_basis is not null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brand_facts_id_website_org_uq` ON `brand_facts` (`id`,`website_id`,`organization_id`);--> statement-breakpoint
CREATE INDEX `brand_facts_website_idx` ON `brand_facts` (`website_id`,`removed_at`,`kind`);--> statement-breakpoint
CREATE TABLE `brand_profile_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`version` integer NOT NULL,
	`official_name` text NOT NULL,
	`display_names` text NOT NULL,
	`aliases` text NOT NULL,
	`abbreviations` text NOT NULL,
	`description` text,
	`target_audience` text,
	`differentiators` text NOT NULL,
	`voice` text,
	`content_summary` text,
	`change_note` text,
	`created_by_user_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`website_id`,`organization_id`) REFERENCES `websites`(`id`,`organization_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brand_profile_versions_number_uq` ON `brand_profile_versions` (`website_id`,`version`);--> statement-breakpoint
CREATE TABLE `website_source_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`page_type` text NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`added_by_user_id` text NOT NULL,
	`removed_at` integer,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`website_id`,`organization_id`) REFERENCES `websites`(`id`,`organization_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `website_source_pages_url_uq` ON `website_source_pages` (`website_id`,`url`) WHERE removed_at is null;--> statement-breakpoint
CREATE TABLE `competitor_domains` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	`host` text NOT NULL,
	`removed_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`competitor_id`,`website_id`,`organization_id`) REFERENCES `competitors`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitor_domains_host_uq` ON `competitor_domains` (`website_id`,`host`) WHERE removed_at is null;--> statement-breakpoint
CREATE INDEX `competitor_domains_competitor_idx` ON `competitor_domains` (`competitor_id`,`removed_at`);--> statement-breakpoint
CREATE TABLE `competitor_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`competitor_id` text NOT NULL,
	`version` integer NOT NULL,
	`action` text NOT NULL,
	`snapshot` text NOT NULL,
	`changed_by_user_id` text NOT NULL,
	`changed_by_name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`competitor_id`,`website_id`,`organization_id`) REFERENCES `competitors`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitor_revisions_number_uq` ON `competitor_revisions` (`competitor_id`,`version`);--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`aliases` text NOT NULL,
	`market` text,
	`business_category` text,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`evidence` text,
	`evidence_url` text,
	`confirmed_at` integer,
	`confirmed_by_name` text,
	`removed_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`website_id`,`organization_id`) REFERENCES `websites`(`id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "competitors_status_check" CHECK(status in ('suggested', 'confirmed', 'archived')),
	CONSTRAINT "competitors_source_check" CHECK(source in ('owner', 'suggestion', 'imported'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `competitors_id_website_org_uq` ON `competitors` (`id`,`website_id`,`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `competitors_name_uq` ON `competitors` (`website_id`,`name_key`) WHERE removed_at is null;--> statement-breakpoint
CREATE INDEX `competitors_website_idx` ON `competitors` (`website_id`,`removed_at`,`status`);--> statement-breakpoint
CREATE TABLE `product_service_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`product_id` text NOT NULL,
	`version` integer NOT NULL,
	`action` text NOT NULL,
	`snapshot` text NOT NULL,
	`changed_by_user_id` text NOT NULL,
	`changed_by_name` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`product_id`,`website_id`,`organization_id`) REFERENCES `products_services`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_service_versions_number_uq` ON `product_service_versions` (`product_id`,`version`);--> statement-breakpoint
CREATE TABLE `products_services` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`description` text,
	`attributes` text NOT NULL,
	`urls` text NOT NULL,
	`price_amount` text,
	`currency` text,
	`availability` text,
	`source` text NOT NULL,
	`source_url` text,
	`status` text DEFAULT 'active' NOT NULL,
	`removed_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`website_id`,`organization_id`) REFERENCES `websites`(`id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "products_services_kind_check" CHECK(kind in ('product', 'service', 'other')),
	CONSTRAINT "products_services_status_check" CHECK(status in ('active', 'archived')),
	CONSTRAINT "products_services_source_check" CHECK(source in ('owner', 'website', 'imported')),
	CONSTRAINT "products_services_price_check" CHECK((price_amount is null) = (currency is null))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_services_id_website_org_uq` ON `products_services` (`id`,`website_id`,`organization_id`);--> statement-breakpoint
CREATE INDEX `products_services_website_idx` ON `products_services` (`website_id`,`removed_at`,`status`);--> statement-breakpoint
CREATE TABLE `prompt_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`purpose` text NOT NULL,
	`version_rule` text NOT NULL,
	`pinned_version_id` text,
	`providers` text NOT NULL,
	`markets` text NOT NULL,
	`languages` text NOT NULL,
	`search_modes` text NOT NULL,
	`samples` integer NOT NULL,
	`removed_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`prompt_id`,`website_id`,`organization_id`) REFERENCES `prompts`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pinned_version_id`,`prompt_id`) REFERENCES `prompt_versions`(`id`,`prompt_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "prompt_assignments_purpose_check" CHECK(purpose in ('audit', 'monitoring')),
	CONSTRAINT "prompt_assignments_rule_check" CHECK(version_rule in ('latest_approved', 'pinned')),
	CONSTRAINT "prompt_assignments_pin_check" CHECK((version_rule = 'pinned') = (pinned_version_id is not null)),
	CONSTRAINT "prompt_assignments_samples_check" CHECK(samples between 1 and 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_assignments_purpose_uq` ON `prompt_assignments` (`prompt_id`,`purpose`) WHERE removed_at is null;--> statement-breakpoint
CREATE TABLE `prompt_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`removed_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`website_id`,`organization_id`) REFERENCES `websites`(`id`,`organization_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_groups_id_website_org_uq` ON `prompt_groups` (`id`,`website_id`,`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_groups_name_uq` ON `prompt_groups` (`website_id`,`name_key`) WHERE removed_at is null;--> statement-breakpoint
CREATE TABLE `prompt_products` (
	`prompt_id` text NOT NULL,
	`product_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`prompt_id`,`website_id`,`organization_id`) REFERENCES `prompts`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`,`website_id`,`organization_id`) REFERENCES `products_services`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_products_uq` ON `prompt_products` (`prompt_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `prompt_tags` (
	`prompt_id` text NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`tag` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`prompt_id`,`website_id`,`organization_id`) REFERENCES `prompts`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_tags_uq` ON `prompt_tags` (`prompt_id`,`tag`);--> statement-breakpoint
CREATE INDEX `prompt_tags_website_idx` ON `prompt_tags` (`website_id`,`tag`);--> statement-breakpoint
CREATE TABLE `prompt_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`version` integer NOT NULL,
	`text` text NOT NULL,
	`normalized_text` text NOT NULL,
	`market` text NOT NULL,
	`language` text NOT NULL,
	`search_mode` text NOT NULL,
	`change_summary` text,
	`created_by_user_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`approved_at` integer,
	`approved_by_user_id` text,
	`approved_by_name` text,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`prompt_id`,`website_id`,`organization_id`) REFERENCES `prompts`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "prompt_versions_search_mode_check" CHECK(search_mode in ('model_only', 'web_grounded_required', 'web_grounded_auto'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_versions_number_uq` ON `prompt_versions` (`prompt_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_versions_id_prompt_uq` ON `prompt_versions` (`id`,`prompt_id`);--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`website_id` text NOT NULL,
	`group_id` text,
	`intent` text NOT NULL,
	`topic` text,
	`scope` text NOT NULL,
	`is_core` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_version` integer NOT NULL,
	`text` text NOT NULL,
	`normalized_text` text NOT NULL,
	`market` text NOT NULL,
	`language` text NOT NULL,
	`search_mode` text NOT NULL,
	`archived_at` integer,
	`deleted_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_by_name` text NOT NULL,
	`change_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsec') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`website_id`,`organization_id`) REFERENCES `websites`(`id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`group_id`,`website_id`,`organization_id`) REFERENCES `prompt_groups`(`id`,`website_id`,`organization_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "prompts_intent_check" CHECK(intent in ('discovery', 'recommendation', 'comparison', 'alternative', 'product_service', 'local_market', 'informational')),
	CONSTRAINT "prompts_scope_check" CHECK(scope in ('audit', 'monitoring', 'both')),
	CONSTRAINT "prompts_status_check" CHECK(status in ('draft', 'active', 'paused', 'archived', 'deleted')),
	CONSTRAINT "prompts_source_check" CHECK(source in ('manual', 'template', 'imported', 'research_derived', 'ai_generated')),
	CONSTRAINT "prompts_search_mode_check" CHECK(search_mode in ('model_only', 'web_grounded_required', 'web_grounded_auto'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompts_id_website_org_uq` ON `prompts` (`id`,`website_id`,`organization_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `prompts_wording_uq` ON `prompts` (`website_id`,`market`,`language`,`normalized_text`) WHERE status <> 'deleted';--> statement-breakpoint
CREATE INDEX `prompts_website_idx` ON `prompts` (`website_id`,`status`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `prompts_org_status_idx` ON `prompts` (`organization_id`,`status`);