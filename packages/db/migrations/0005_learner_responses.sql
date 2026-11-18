CREATE TABLE "learner_responses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"block_id" text NOT NULL,
	"item_id" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"claim_id" uuid,
	"response" jsonb NOT NULL,
	"result" jsonb,
	"correct" integer,
	"confidence" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "confident_error_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "learner_responses" ADD CONSTRAINT "learner_responses_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_responses" ADD CONSTRAINT "learner_responses_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_responses" ADD CONSTRAINT "learner_responses_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learner_responses_page_idx" ON "learner_responses" USING btree ("actor_id","page_id");--> statement-breakpoint
CREATE INDEX "learner_responses_at_idx" ON "learner_responses" USING btree ("actor_id","at");