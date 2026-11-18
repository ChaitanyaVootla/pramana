-- Live updates name whose personal data changed (notes, AI sessions, canvases, views), so the event
-- stream forwards each to its owner only. A note belongs to the human it was posted for; content
-- (changesets) carries no owner and goes to everyone.
CREATE OR REPLACE FUNCTION pramana_notify() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'notes' THEN
    PERFORM pg_notify('pramana', json_build_object('table', 'notes', 'id', NEW.id, 'op', TG_OP,
      'owner', coalesce(NEW.on_behalf_of_id, NEW.actor_id))::text);
  ELSIF TG_TABLE_NAME = 'sessions' THEN
    PERFORM pg_notify('pramana', json_build_object('table', 'sessions', 'id', NEW.id, 'op', TG_OP,
      'owner', NEW.on_behalf_of_id)::text);
  ELSE
    PERFORM pg_notify('pramana', json_build_object('table', TG_TABLE_NAME, 'id', NEW.id, 'op', TG_OP)::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION pramana_notify_personal() RETURNS trigger AS $$
DECLARE
  rec record;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;
  IF TG_TABLE_NAME = 'user_views' THEN
    PERFORM pg_notify('pramana', json_build_object('table', 'user_views', 'id', rec.subject_id, 'op', TG_OP,
      'owner', rec.owner_id)::text);
  ELSE
    PERFORM pg_notify('pramana', json_build_object('table', TG_TABLE_NAME, 'id', rec.id, 'op', TG_OP,
      'owner', rec.owner_id)::text);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
