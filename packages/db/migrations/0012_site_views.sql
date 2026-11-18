-- A learner's site-wide view (the appearance panel: text size, line width, evidence density, theme)
-- lives in user_views too, as subject_type 'site' with one fixed subject id (core SITE_VIEW_ID).
ALTER TABLE "user_views" DROP CONSTRAINT "user_views_subject_check";--> statement-breakpoint
ALTER TABLE "user_views" ADD CONSTRAINT "user_views_subject_check" CHECK ("subject_type" IN ('page', 'entity', 'site'));
