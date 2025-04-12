ALTER TABLE "favorites" DROP CONSTRAINT "favorites_user_id_channel_id_pk";--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_channel_idx" ON "favorites" USING btree ("user_id","channel_id");