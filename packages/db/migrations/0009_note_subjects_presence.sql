ALTER TABLE "notes" ADD COLUMN "subject_type" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "subject_id" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "notes_subject_idx" ON "notes" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "sessions_seen_idx" ON "sessions" USING btree ("last_seen_at");--> statement-breakpoint
-- Existing notes: those on a page are about that page; the rest are general.
UPDATE "notes" SET "subject_type" = 'page', "subject_id" = "page_id" WHERE "page_id" IS NOT NULL;--> statement-breakpoint
-- Presence: tell the web app's SSE stream when an agent session starts, is active, or ends.
CREATE TRIGGER sessions_notify AFTER INSERT OR UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION pramana_notify();
--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_subject_check" CHECK (
  "subject_type" IN ('general', 'page', 'entity', 'claim', 'source', 'canvas')
  AND ("subject_type" = 'general') = ("subject_id" IS NULL)
);
