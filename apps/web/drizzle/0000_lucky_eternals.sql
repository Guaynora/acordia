CREATE TYPE "public"."recording_provider" AS ENUM('youtube', 'spotify');--> statement-breakpoint
CREATE TABLE "arrangements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" uuid NOT NULL,
	"key" text NOT NULL,
	"chordpro" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"song_id" uuid NOT NULL,
	"provider" "recording_provider" NOT NULL,
	"external_id" text NOT NULL,
	"key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"original_key" text NOT NULL,
	"tempo" integer,
	"time_signature" text DEFAULT '4/4' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arrangements" ADD CONSTRAINT "arrangements_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arrangements_song_idx" ON "arrangements" USING btree ("song_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recordings_song_provider_external_idx" ON "recordings" USING btree ("song_id","provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "songs_slug_idx" ON "songs" USING btree ("slug");