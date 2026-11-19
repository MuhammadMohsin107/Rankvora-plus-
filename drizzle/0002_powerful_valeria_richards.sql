CREATE TYPE "public"."prompt_intent" AS ENUM('discovery', 'recommendation', 'comparison', 'alternative', 'product_service', 'local_market', 'informational');--> statement-breakpoint
CREATE TYPE "public"."prompt_source" AS ENUM('manual', 'ai_generated', 'imported', 'research_derived', 'template');--> statement-breakpoint
CREATE TYPE "public"."prompt_status" AS ENUM('draft', 'active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "public"."prompt_tracking_scope" AS ENUM('audit', 'monitoring', 'both');--> statement-breakpoint
CREATE TABLE "prompt_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_groups_id_store_id_unique" UNIQUE("id","store_id")
);
--> statement-breakpoint
CREATE TABLE "prompt_products" (
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"product_service_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_products_pk" PRIMARY KEY("prompt_id","product_service_id")
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"text" text NOT NULL,
	"intent" "prompt_intent" NOT NULL,
	"topic" text,
	"language" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_templates_id_organization_id_unique" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"prompt_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"text" text NOT NULL,
	"text_hash" text NOT NULL,
	"language" text NOT NULL,
	"country" char(2) NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_versions_prompt_version_unique" UNIQUE("prompt_id","version"),
	CONSTRAINT "prompt_versions_id_store_id_unique" UNIQUE("id","store_id"),
	CONSTRAINT "prompt_versions_version_positive" CHECK ("prompt_versions"."version" >= 1),
	CONSTRAINT "prompt_versions_country_format" CHECK ("prompt_versions"."country" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"group_id" uuid,
	"topic" text,
	"intent" "prompt_intent" NOT NULL,
	"language" text NOT NULL,
	"country" char(2) NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"text_hash" text NOT NULL,
	"is_core" boolean DEFAULT false NOT NULL,
	"creation_source" "prompt_source" DEFAULT 'manual' NOT NULL,
	"source_template_id" uuid,
	"status" "prompt_status" DEFAULT 'draft' NOT NULL,
	"tracking_scope" "prompt_tracking_scope" DEFAULT 'both' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompts_id_store_id_unique" UNIQUE("id","store_id"),
	CONSTRAINT "prompts_country_format" CHECK ("prompts"."country" ~ '^[A-Z]{2}$'),
	CONSTRAINT "prompts_current_version_positive" CHECK ("prompts"."current_version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "products_services" ADD CONSTRAINT "products_services_id_store_id_unique" UNIQUE("id","store_id");--> statement-breakpoint
ALTER TABLE "prompt_groups" ADD CONSTRAINT "prompt_groups_store_org_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_products" ADD CONSTRAINT "prompt_products_store_org_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_products" ADD CONSTRAINT "prompt_products_prompt_store_fk" FOREIGN KEY ("prompt_id","store_id") REFERENCES "public"."prompts"("id","store_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_products" ADD CONSTRAINT "prompt_products_product_store_fk" FOREIGN KEY ("product_service_id","store_id") REFERENCES "public"."products_services"("id","store_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_templates" ADD CONSTRAINT "prompt_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_store_org_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_prompt_store_fk" FOREIGN KEY ("prompt_id","store_id") REFERENCES "public"."prompts"("id","store_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_store_org_fk" FOREIGN KEY ("store_id","organization_id") REFERENCES "public"."stores"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_group_store_fk" FOREIGN KEY ("group_id","store_id") REFERENCES "public"."prompt_groups"("id","store_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_template_org_fk" FOREIGN KEY ("source_template_id","organization_id") REFERENCES "public"."prompt_templates"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_groups_store_name_unique" ON "prompt_groups" USING btree ("store_id",lower("name"));--> statement-breakpoint
CREATE INDEX "prompt_groups_organization_id_idx" ON "prompt_groups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "prompt_products_product_idx" ON "prompt_products" USING btree ("product_service_id");--> statement-breakpoint
CREATE INDEX "prompt_products_store_id_idx" ON "prompt_products" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "prompt_templates_organization_id_idx" ON "prompt_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "prompt_versions_store_id_idx" ON "prompt_versions" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "prompt_versions_organization_id_idx" ON "prompt_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prompts_store_text_unique" ON "prompts" USING btree ("store_id","language","country","text_hash") WHERE "prompts"."status" <> 'archived';--> statement-breakpoint
CREATE INDEX "prompts_store_status_idx" ON "prompts" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "prompts_group_id_idx" ON "prompts" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "prompts_organization_id_idx" ON "prompts" USING btree ("organization_id");
