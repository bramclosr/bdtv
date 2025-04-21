ALTER TABLE "channels" ALTER COLUMN "name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "group_title" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "channels" ALTER COLUMN "tvg_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "locationCode" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "cleanedGroupTitle" text;