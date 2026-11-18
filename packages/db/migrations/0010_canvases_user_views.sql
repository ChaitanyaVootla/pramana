CREATE TABLE "canvas_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"canvas_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"content" jsonb NOT NULL,
	"layout" jsonb NOT NULL,
	"added_by_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvases" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_views" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_id" uuid NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"view" jsonb NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_items" ADD CONSTRAINT "canvas_items_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_items" ADD CONSTRAINT "canvas_items_added_by_id_actors_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_owner_id_actors_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_views" ADD CONSTRAINT "user_views_owner_id_actors_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canvas_items_canvas_idx" ON "canvas_items" USING btree ("canvas_id");--> statement-breakpoint
CREATE INDEX "canvases_owner_idx" ON "canvases" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_views_subject" ON "user_views" USING btree ("owner_id","subject_type","subject_id");--> statement-breakpoint
ALTER TABLE "user_views" ADD CONSTRAINT "user_views_subject_check" CHECK ("subject_type" IN ('page', 'entity'));
--> statement-breakpoint
-- Live updates for personal workspace: an open canvas or page refreshes when the learner's AI changes it.
-- Item changes bump their canvas's version, so the canvas row is the one signal. User views signal the
-- page or entity they are about (the open page knows its own id), never the view's contents.
CREATE OR REPLACE FUNCTION pramana_notify_personal() RETURNS trigger AS $$
DECLARE
  rec record;
BEGIN
  IF TG_OP = 'DELETE' THEN rec := OLD; ELSE rec := NEW; END IF;
  IF TG_TABLE_NAME = 'user_views' THEN
    PERFORM pg_notify('pramana', json_build_object('table', 'user_views', 'id', rec.subject_id, 'op', TG_OP)::text);
  ELSE
    PERFORM pg_notify('pramana', json_build_object('table', TG_TABLE_NAME, 'id', rec.id, 'op', TG_OP)::text);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER canvases_notify AFTER INSERT OR UPDATE OR DELETE ON canvases
  FOR EACH ROW EXECUTE FUNCTION pramana_notify_personal();
--> statement-breakpoint
CREATE TRIGGER user_views_notify AFTER INSERT OR UPDATE OR DELETE ON user_views
  FOR EACH ROW EXECUTE FUNCTION pramana_notify_personal();
