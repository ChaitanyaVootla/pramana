ALTER TABLE "review_logs" ADD COLUMN "client_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "review_logs_client_key" ON "review_logs" USING btree ("actor_id","client_key");