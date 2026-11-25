-- Database guards that drizzle-kit cannot express. They hold even if application code has a bug
-- or two requests race each other (D1 has no interactive transactions).

-- An organization that is not deleted always keeps at least one active owner.
CREATE TRIGGER organization_members_last_owner_update
BEFORE UPDATE OF role, status ON organization_members
WHEN OLD.role = 'owner' AND OLD.status = 'active' AND (NEW.role <> 'owner' OR NEW.status <> 'active')
  AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = OLD.organization_id AND o.status <> 'deleted')
  AND NOT EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = OLD.organization_id AND m.id <> OLD.id AND m.role = 'owner' AND m.status = 'active')
BEGIN
  SELECT RAISE(ABORT, 'last_owner');
END;
--> statement-breakpoint
CREATE TRIGGER organization_members_last_owner_delete
BEFORE DELETE ON organization_members
WHEN OLD.role = 'owner' AND OLD.status = 'active'
  AND EXISTS (SELECT 1 FROM organizations o WHERE o.id = OLD.organization_id AND o.status <> 'deleted')
  AND NOT EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id = OLD.organization_id AND m.id <> OLD.id AND m.role = 'owner' AND m.status = 'active')
BEGIN
  SELECT RAISE(ABORT, 'last_owner');
END;
--> statement-breakpoint
-- Rows can never move between tenants.
CREATE TRIGGER organization_members_identity_immutable
BEFORE UPDATE OF organization_id, user_id ON organization_members
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.user_id IS NOT OLD.user_id
BEGIN
  SELECT RAISE(ABORT, 'immutable_tenant');
END;
--> statement-breakpoint
CREATE TRIGGER websites_tenant_immutable
BEFORE UPDATE OF organization_id ON websites
WHEN NEW.organization_id IS NOT OLD.organization_id
BEGIN
  SELECT RAISE(ABORT, 'immutable_tenant');
END;
--> statement-breakpoint
-- A domain row is history: changing the hostname means retiring this row and adding another.
CREATE TRIGGER website_domains_identity_immutable
BEFORE UPDATE OF organization_id, website_id, host ON website_domains
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id OR NEW.host IS NOT OLD.host
BEGIN
  SELECT RAISE(ABORT, 'immutable_domain');
END;
--> statement-breakpoint
CREATE TRIGGER usage_reservations_identity_immutable
BEFORE UPDATE OF organization_id, website_id, metric, quantity, period ON usage_reservations
WHEN NEW.organization_id IS NOT OLD.organization_id OR NEW.website_id IS NOT OLD.website_id OR NEW.metric IS NOT OLD.metric
  OR NEW.quantity IS NOT OLD.quantity OR NEW.period IS NOT OLD.period
BEGIN
  SELECT RAISE(ABORT, 'immutable_reservation');
END;
--> statement-breakpoint
-- Append-only history.
CREATE TRIGGER activity_logs_no_update BEFORE UPDATE ON activity_logs
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER activity_logs_no_delete BEFORE DELETE ON activity_logs
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER security_audit_logs_no_update BEFORE UPDATE ON security_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER security_audit_logs_no_delete BEFORE DELETE ON security_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER usage_ledger_no_update BEFORE UPDATE ON usage_ledger
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
--> statement-breakpoint
CREATE TRIGGER usage_ledger_no_delete BEFORE DELETE ON usage_ledger
BEGIN
  SELECT RAISE(ABORT, 'append_only');
END;
