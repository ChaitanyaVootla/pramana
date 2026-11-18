CREATE TABLE "extents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" uuid,
	"name" text NOT NULL,
	"from_year" integer NOT NULL,
	"to_year" integer NOT NULL,
	"geometry" jsonb NOT NULL,
	"min_lon" double precision NOT NULL,
	"min_lat" double precision NOT NULL,
	"max_lon" double precision NOT NULL,
	"max_lat" double precision NOT NULL,
	"area_km2" double precision,
	"dataset" text NOT NULL,
	"dataset_ref" text,
	"certainty" text DEFAULT 'reconstruction' NOT NULL,
	"license" text NOT NULL,
	"attribution" text NOT NULL,
	"source_id" uuid,
	"note" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "spans" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "extents" ADD CONSTRAINT "extents_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extents" ADD CONSTRAINT "extents_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extents_entity_idx" ON "extents" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "extents_years_idx" ON "extents" USING btree ("from_year","to_year");--> statement-breakpoint
CREATE UNIQUE INDEX "extents_dataset_row_unique" ON "extents" USING btree ("dataset","name","from_year","to_year");