DROP INDEX IF EXISTS "idx_channels_group_title";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_channels_group_title" ON "channels" USING btree ("cleanedGroupTitle");--> statement-breakpoint
ALTER TABLE "channels" DROP COLUMN IF EXISTS "group_title";