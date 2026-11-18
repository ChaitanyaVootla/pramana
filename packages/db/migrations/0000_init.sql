CREATE TYPE "public"."actor_kind" AS ENUM('human', 'agent', 'importer', 'system');--> statement-breakpoint
CREATE TYPE "public"."changeset_status" AS ENUM('proposed', 'applied', 'rejected', 'withdrawn', 'failed');--> statement-breakpoint
CREATE TABLE "actors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" "actor_kind" NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actors_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"fsrs" jsonb NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changesets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"status" "changeset_status" DEFAULT 'proposed' NOT NULL,
	"title" text NOT NULL,
	"rationale" text DEFAULT '' NOT NULL,
	"ops" jsonb NOT NULL,
	"refs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"depends_on" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"report" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"author_id" uuid NOT NULL,
	"on_behalf_of_id" uuid,
	"session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"applied_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "citations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"claim_id" uuid NOT NULL,
	"excerpt_id" uuid NOT NULL,
	"stance" text NOT NULL,
	"note" text,
	"support_check" jsonb DEFAULT '{"status":"unchecked"}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claim_entities" (
	"claim_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"role" text DEFAULT 'subject' NOT NULL,
	CONSTRAINT "claim_entities_claim_id_entity_id_pk" PRIMARY KEY("claim_id","entity_id")
);
--> statement-breakpoint
CREATE TABLE "claim_relations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"type" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"kind" text NOT NULL,
	"assessment" text DEFAULT 'unassessed' NOT NULL,
	"assessment_note" text,
	"when" jsonb,
	"sort_start" double precision,
	"themes" text[] DEFAULT '{}'::text[] NOT NULL,
	"lenses" text[] DEFAULT '{}'::text[] NOT NULL,
	"found_via" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"learning" jsonb,
	"search_text" text,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(search_text, ''))) STORED,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"when" jsonb,
	"bounds" jsonb,
	"sort_start" double precision,
	"sort_end" double precision,
	"geo" jsonb,
	"wikidata_id" text,
	"external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_text" text,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(search_text, ''))) STORED,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "entity_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"type" text NOT NULL,
	"when" jsonb,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid NOT NULL,
	"on_behalf_of_id" uuid,
	"session_id" uuid,
	"action" text NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"changeset_id" uuid,
	"rationale" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "excerpts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"snapshot_id" uuid,
	"quote" text,
	"locator" jsonb,
	"selector" jsonb,
	"original" jsonb,
	"note" text,
	"verification" jsonb DEFAULT '{"status":"unchecked"}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid,
	"actor_id" uuid NOT NULL,
	"on_behalf_of_id" uuid,
	"page_id" uuid,
	"anchor_block_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"claim_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"viz" jsonb,
	"status" text DEFAULT 'live' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"page_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"blocks" jsonb NOT NULL,
	"changeset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_visits" (
	"actor_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visits" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "page_visits_actor_id_page_id_pk" PRIMARY KEY("actor_id","page_id")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"entity_id" uuid,
	"summary" text,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"position" double precision,
	"search_text" text,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(search_text, ''))) STORED,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "review_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"card_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"rating" text NOT NULL,
	"confidence" integer,
	"correct" integer,
	"log" jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"on_behalf_of_id" uuid,
	"client" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"origin" text NOT NULL,
	"url" text,
	"archive_url" text,
	"title" text,
	"media_type" text DEFAULT 'text/plain' NOT NULL,
	"sha256" text NOT NULL,
	"byte_size" integer NOT NULL,
	"char_count" integer NOT NULL,
	"storage_path" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"captured_by_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"tier" text NOT NULL,
	"title" text NOT NULL,
	"csl" jsonb NOT NULL,
	"identifiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"license" jsonb DEFAULT '{"status":"unknown"}'::jsonb NOT NULL,
	"derived_from_id" uuid,
	"composed" jsonb,
	"lenses" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text,
	"search_text" text,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(search_text, ''))) STORED,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changesets" ADD CONSTRAINT "changesets_author_id_actors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changesets" ADD CONSTRAINT "changesets_on_behalf_of_id_actors_id_fk" FOREIGN KEY ("on_behalf_of_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changesets" ADD CONSTRAINT "changesets_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changesets" ADD CONSTRAINT "changesets_decided_by_id_actors_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "citations" ADD CONSTRAINT "citations_excerpt_id_excerpts_id_fk" FOREIGN KEY ("excerpt_id") REFERENCES "public"."excerpts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_entities" ADD CONSTRAINT "claim_entities_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_entities" ADD CONSTRAINT "claim_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_relations" ADD CONSTRAINT "claim_relations_from_id_claims_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_relations" ADD CONSTRAINT "claim_relations_to_id_claims_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_from_id_entities_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_links" ADD CONSTRAINT "entity_links_to_id_entities_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_on_behalf_of_id_actors_id_fk" FOREIGN KEY ("on_behalf_of_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excerpts" ADD CONSTRAINT "excerpts_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "excerpts" ADD CONSTRAINT "excerpts_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_on_behalf_of_id_actors_id_fk" FOREIGN KEY ("on_behalf_of_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_changeset_id_changesets_id_fk" FOREIGN KEY ("changeset_id") REFERENCES "public"."changesets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_visits" ADD CONSTRAINT "page_visits_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_visits" ADD CONSTRAINT "page_visits_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_logs" ADD CONSTRAINT "review_logs_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_on_behalf_of_id_actors_id_fk" FOREIGN KEY ("on_behalf_of_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_captured_by_id_actors_id_fk" FOREIGN KEY ("captured_by_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cards_unique" ON "cards" USING btree ("actor_id","claim_id");--> statement-breakpoint
CREATE INDEX "cards_due_idx" ON "cards" USING btree ("actor_id","due");--> statement-breakpoint
CREATE INDEX "changesets_status_idx" ON "changesets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "citations_unique" ON "citations" USING btree ("claim_id","excerpt_id");--> statement-breakpoint
CREATE INDEX "citations_excerpt_idx" ON "citations" USING btree ("excerpt_id");--> statement-breakpoint
CREATE INDEX "claim_entities_entity_idx" ON "claim_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "claim_relations_unique" ON "claim_relations" USING btree ("from_id","to_id","type");--> statement-breakpoint
CREATE INDEX "claim_relations_to_idx" ON "claim_relations" USING btree ("to_id");--> statement-breakpoint
CREATE INDEX "claims_search_idx" ON "claims" USING gin ("search");--> statement-breakpoint
CREATE INDEX "claims_kind_idx" ON "claims" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "entities_wikidata_idx" ON "entities" USING btree ("wikidata_id");--> statement-breakpoint
CREATE INDEX "entities_kind_idx" ON "entities" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "entities_sort_idx" ON "entities" USING btree ("sort_start");--> statement-breakpoint
CREATE INDEX "entities_search_idx" ON "entities" USING gin ("search");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_links_unique" ON "entity_links" USING btree ("from_id","to_id","type");--> statement-breakpoint
CREATE INDEX "entity_links_to_idx" ON "entity_links" USING btree ("to_id");--> statement-breakpoint
CREATE INDEX "events_subject_idx" ON "events" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "events_changeset_idx" ON "events" USING btree ("changeset_id");--> statement-breakpoint
CREATE INDEX "events_at_idx" ON "events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "excerpts_source_idx" ON "excerpts" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "notes_page_idx" ON "notes" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "notes_created_idx" ON "notes" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "page_revisions_unique" ON "page_revisions" USING btree ("page_id","version");--> statement-breakpoint
CREATE INDEX "pages_search_idx" ON "pages" USING gin ("search");--> statement-breakpoint
CREATE INDEX "pages_kind_idx" ON "pages" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "review_logs_card_idx" ON "review_logs" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "sessions_actor_idx" ON "sessions" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "snapshots_sha_idx" ON "snapshots" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "sources_search_idx" ON "sources" USING gin ("search");--> statement-breakpoint
CREATE INDEX "sources_derived_idx" ON "sources" USING btree ("derived_from_id");