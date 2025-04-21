CREATE TABLE IF NOT EXISTS "channels" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"group_title" varchar(255),
	"tvg_id" varchar(255),
	"tvg_logo" text,
	"url" text NOT NULL,
	"parsed_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "channels_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_channels_group_title" ON "channels" USING btree ("group_title");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_channels_name" ON "channels" USING btree ("name");