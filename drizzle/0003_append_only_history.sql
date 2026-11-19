-- Version history is append-only: a new version is always a new row. These
-- triggers make that a database guarantee instead of a convention, so no code
-- path (or manual query) can quietly rewrite what an earlier run was based on.
CREATE OR REPLACE FUNCTION prevent_row_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed: rows in this table are immutable', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER prompt_versions_immutable
  BEFORE UPDATE OR DELETE ON "prompt_versions"
  FOR EACH ROW EXECUTE FUNCTION prevent_row_mutation();
--> statement-breakpoint
CREATE TRIGGER brand_profiles_immutable
  BEFORE UPDATE OR DELETE ON "brand_profiles"
  FOR EACH ROW EXECUTE FUNCTION prevent_row_mutation();
