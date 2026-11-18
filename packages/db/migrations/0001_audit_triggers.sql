-- The audit log is append-only: history must not be rewritten.
CREATE OR REPLACE FUNCTION events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'events is append-only (% blocked)', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER events_no_update BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION events_append_only();
--> statement-breakpoint
CREATE TRIGGER events_no_truncate BEFORE TRUNCATE ON events
  FOR EACH STATEMENT EXECUTE FUNCTION events_append_only();
--> statement-breakpoint
-- Live updates: notify listeners (the web app's SSE stream) when notes or changesets change.
CREATE OR REPLACE FUNCTION pramana_notify() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('pramana', json_build_object('table', TG_TABLE_NAME, 'id', NEW.id, 'op', TG_OP)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER notes_notify AFTER INSERT OR UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION pramana_notify();
--> statement-breakpoint
CREATE TRIGGER changesets_notify AFTER INSERT OR UPDATE ON changesets
  FOR EACH ROW EXECUTE FUNCTION pramana_notify();
