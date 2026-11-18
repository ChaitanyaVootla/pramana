CREATE TABLE "media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text DEFAULT 'image' NOT NULL,
	"repository" text NOT NULL,
	"file_title" text NOT NULL,
	"page_url" text NOT NULL,
	"original_url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"mime" text NOT NULL,
	"sha1" text,
	"license" jsonb NOT NULL,
	"artist" text,
	"credit" text,
	"attribution" text NOT NULL,
	"title" text NOT NULL,
	"alt" text NOT NULL,
	"description" text,
	"representation" text NOT NULL,
	"representation_note" text,
	"object_date" jsonb,
	"image_date" jsonb,
	"depicts" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"focus" jsonb,
	"snapshot_id" uuid NOT NULL,
	"retrieved_at" timestamp with time zone NOT NULL,
	"search_text" text,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(search_text, ''))) STORED,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_file_unique" ON "media" USING btree ("repository","file_title");--> statement-breakpoint
CREATE INDEX "media_depicts_idx" ON "media" USING gin ("depicts");--> statement-breakpoint
CREATE INDEX "media_search_idx" ON "media" USING gin ("search");