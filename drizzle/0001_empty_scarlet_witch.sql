CREATE TYPE "public"."competitor_status" AS ENUM('suggested', 'confirmed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('owner', 'admin', 'editor', 'auditor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."record_source" AS ENUM('manual', 'ai_suggested', 'imported', 'connector');--> statement-breakpoint
CREATE TYPE "public"."store_domain_kind" AS ENUM('alias', 'redirect', 'previous_canonical');--> statement-breakpoint
CREATE TYPE "public"."store_platform" AS ENUM('shopify', 'woocommerce', 'wordpress', 'webflow', 'custom', 'manual');--> statement-breakpoint
CREATE TYPE "public"."store_status" AS ENUM('draft', 'needs_review', 'ready', 'active', 'paused', 'disconnected', 'archived');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"brand_name" text NOT NULL,
	"legal_name" text,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"differentiators" text,
	"target_audience" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_profiles_store_version_unique" UNIQUE("store_id","version"),
	CONSTRAINT "brand_profiles_version_positive" CHECK ("brand_profiles"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"market" char(2),
	"competitor_type" text,
	"status" "competitor_status" DEFAULT 'suggested' NOT NULL,
	"source" "record_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitors_market_format" CHECK ("competitors"."market" is null or "competitors"."market" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_memberships_org_user_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"timezone_default" text DEFAULT 'UTC' NOT NULL,
	"status" "organization_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"external_id" text,
	"title" text NOT NULL,
	"url" text,
	"category" text,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" "record_source" DEFAULT 'manual' NOT NULL,
	"source_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"host" text NOT NULL,
	"kind" "store_domain_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_domains_store_host_unique" UNIQUE("store_id","host"),
	CONSTRAINT "store_domains_host_lowercase" CHECK ("store_domains"."host" = lower("store_domains"."host"))
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"brand_group_id" uuid,
	"name" text NOT NULL,
	"platform_type" "store_platform" NOT NULL,
	"canonical_domain" text NOT NULL,
	"market" char(2) NOT NULL,
	"language" text NOT NULL,
	"timezone" text NOT NULL,
	"industry" text,
	"description" text,
	"status" "store_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_id_organization_id_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "stores_market_format" CHECK ("stores"."market" ~ '^[A-Z]{2}$'),
	CONSTRAINT "stores_domain_lowercase" CHECK ("stores"."canonical_domain" = lower("stores"."canonical_domain"))
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_store_org_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_store_org_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_store_org_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products_services" ADD CONSTRAINT "products_services_store_org_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_domains" ADD CONSTRAINT "store_domains_store_org_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_logs_org_created_idx" ON "activity_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_logs_store_created_idx" ON "activity_logs" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "brand_profiles_organization_id_idx" ON "brand_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competitors_store_name_unique" ON "competitors" USING btree ("store_id",lower("name")) WHERE "competitors"."status" <> 'archived';--> statement-breakpoint
CREATE INDEX "competitors_organization_id_idx" ON "competitors" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_id_idx" ON "organization_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_services_store_external_unique" ON "products_services" USING btree ("store_id","external_id") WHERE "products_services"."external_id" is not null;--> statement-breakpoint
CREATE INDEX "products_services_store_id_idx" ON "products_services" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "products_services_organization_id_idx" ON "products_services" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "store_domains_organization_id_idx" ON "store_domains" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stores_org_domain_unique" ON "stores" USING btree ("organization_id","canonical_domain") WHERE "stores"."status" <> 'archived';--> statement-breakpoint
CREATE INDEX "stores_organization_id_idx" ON "stores" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stores_brand_group_id_idx" ON "stores" USING btree ("brand_group_id");