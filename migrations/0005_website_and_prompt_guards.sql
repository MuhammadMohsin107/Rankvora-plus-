-- Guards for the Phase 2 tables, beyond what drizzle-kit can express.

-- Append-only history: what the brand, a fact, a competitor or an offering said at the time.
CREATE TRIGGER brand_profile_versions_no_update BEFORE UPDATE ON brand_profile_versions
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER brand_profile_versions_no_delete BEFORE DELETE ON brand_profile_versions
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER brand_fact_versions_no_update BEFORE UPDATE ON brand_fact_versions
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER brand_fact_versions_no_delete BEFORE DELETE ON brand_fact_versions
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER competitor_revisions_no_update BEFORE UPDATE ON competitor_revisions
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER competitor_revisions_no_delete BEFORE DELETE ON competitor_revisions
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER product_service_versions_no_update BEFORE UPDATE ON product_service_versions
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER product_service_versions_no_delete BEFORE DELETE ON product_service_versions
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER domain_checks_no_update BEFORE UPDATE ON domain_checks
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER domain_checks_no_delete BEFORE DELETE ON domain_checks
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
-- A prompt version never changes. The only allowed write is the first approval.
CREATE TRIGGER prompt_versions_content_immutable BEFORE UPDATE ON prompt_versions
WHEN NEW.id IS NOT OLD.id OR NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id
  OR NEW.prompt_id IS NOT OLD.prompt_id OR NEW.version IS NOT OLD.version OR NEW.text IS NOT OLD.text
  OR NEW.normalized_text IS NOT OLD.normalized_text OR NEW.market IS NOT OLD.market OR NEW.language IS NOT OLD.language
  OR NEW.search_mode IS NOT OLD.search_mode OR NEW.change_summary IS NOT OLD.change_summary
  OR NEW.created_by_user_id IS NOT OLD.created_by_user_id OR NEW.created_by_name IS NOT OLD.created_by_name
  OR NEW.created_at IS NOT OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'immutable_version');
END;
--> statement-breakpoint
CREATE TRIGGER prompt_versions_approval_once BEFORE UPDATE ON prompt_versions
WHEN OLD.approved_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'immutable_version');
END;
--> statement-breakpoint
CREATE TRIGGER prompt_versions_no_delete BEFORE DELETE ON prompt_versions
BEGIN
  SELECT RAISE(ABORT, 'immutable_version');
END;
--> statement-breakpoint
-- Prompts are only ever soft-deleted: past runs will point at them.
CREATE TRIGGER prompts_no_delete BEFORE DELETE ON prompts
BEGIN
  SELECT RAISE(ABORT, 'immutable_version');
END;
--> statement-breakpoint
-- Rows can never move to another customer, website or parent.
CREATE TRIGGER brand_facts_tenant_immutable BEFORE UPDATE OF organization_id, website_id ON brand_facts
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id
BEGIN
  SELECT RAISE(ABORT, 'immutable_tenant');
END;
--> statement-breakpoint
CREATE TRIGGER brand_fact_sources_tenant_immutable BEFORE UPDATE OF organization_id, website_id, fact_id, url ON brand_fact_sources
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id OR NEW.fact_id IS NOT OLD.fact_id OR NEW.url IS NOT OLD.url
BEGIN
  SELECT RAISE(ABORT, 'immutable_tenant');
END;
--> statement-breakpoint
CREATE TRIGGER website_source_pages_tenant_immutable BEFORE UPDATE OF organization_id, website_id ON website_source_pages
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id
BEGIN
  SELECT RAISE(ABORT, 'immutable_tenant');
END;
--> statement-breakpoint
CREATE TRIGGER competitors_tenant_immutable BEFORE UPDATE OF organization_id, website_id ON competitors
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id
BEGIN
  SELECT RAISE(ABORT, 'immutable_tenant');
END;
--> statement-breakpoint
CREATE TRIGGER competitor_domains_tenant_immutable BEFORE UPDATE OF organization_id, website_id, competitor_id, host ON competitor_domains
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id OR NEW.competitor_id IS NOT OLD.competitor_id OR NEW.host IS NOT OLD.host
BEGIN
  SELECT RAISE(ABORT, 'immutable_tenant');
END;
--> statement-breakpoint
CREATE TRIGGER products_services_tenant_immutable BEFORE UPDATE OF organization_id, website_id ON products_services
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id
BEGIN
  SELECT RAISE(ABORT, 'immutable_tenant');
END;
--> statement-breakpoint
CREATE TRIGGER prompt_groups_tenant_immutable BEFORE UPDATE OF organization_id, website_id ON prompt_groups
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id
BEGIN
  SELECT RAISE(ABORT, 'immutable_tenant');
END;
--> statement-breakpoint
CREATE TRIGGER prompts_tenant_immutable BEFORE UPDATE OF organization_id, website_id ON prompts
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id
BEGIN
  SELECT RAISE(ABORT, 'immutable_tenant');
END;
--> statement-breakpoint
CREATE TRIGGER prompt_assignments_tenant_immutable BEFORE UPDATE OF organization_id, website_id, prompt_id, purpose ON prompt_assignments
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id OR NEW.prompt_id IS NOT OLD.prompt_id OR NEW.purpose IS NOT OLD.purpose
BEGIN
  SELECT RAISE(ABORT, 'immutable_tenant');
END;
