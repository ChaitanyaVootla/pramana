CREATE TABLE "canvas_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"canvas_id" uuid NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"label" text,
	"added_by_id" uuid NOT NULL,
	"status" text DEFAULT 'kept' NOT NULL,
	"batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "canvas_items" ADD COLUMN "status" text DEFAULT 'kept' NOT NULL;--> statement-breakpoint
ALTER TABLE "canvas_items" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "canvas_links" ADD CONSTRAINT "canvas_links_canvas_id_canvases_id_fk" FOREIGN KEY ("canvas_id") REFERENCES "public"."canvases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_links" ADD CONSTRAINT "canvas_links_from_id_canvas_items_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."canvas_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_links" ADD CONSTRAINT "canvas_links_to_id_canvas_items_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."canvas_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_links" ADD CONSTRAINT "canvas_links_added_by_id_actors_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canvas_links_canvas_idx" ON "canvas_links" USING btree ("canvas_id");--> statement-breakpoint
ALTER TABLE "canvas_items" ADD CONSTRAINT "canvas_items_status_check" CHECK ("status" IN ('kept', 'pending'));
--> statement-breakpoint
ALTER TABLE "canvas_links" ADD CONSTRAINT "canvas_links_status_check" CHECK ("status" IN ('kept', 'pending'));
--> statement-breakpoint
ALTER TABLE "canvas_links" ADD CONSTRAINT "canvas_links_relation_check" CHECK (
  "relation" IN ('supports', 'contradicts', 'causes', 'precedes', 'same_as', 'questions', 'related')
);
