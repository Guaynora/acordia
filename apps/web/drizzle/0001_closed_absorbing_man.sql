CREATE TYPE "public"."arrangement_kind" AS ENUM('original', 'simplified', 'reharmonization', 'acoustic', 'piano', 'other');--> statement-breakpoint
ALTER TABLE "arrangements" ADD COLUMN "slug" text DEFAULT 'original' NOT NULL;--> statement-breakpoint
ALTER TABLE "arrangements" ADD COLUMN "name" text DEFAULT 'Original' NOT NULL;--> statement-breakpoint
ALTER TABLE "arrangements" ADD COLUMN "kind" "arrangement_kind" DEFAULT 'original' NOT NULL;--> statement-breakpoint
ALTER TABLE "arrangements" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "arrangements" ADD COLUMN "author_name" text;--> statement-breakpoint
ALTER TABLE "arrangements" ADD COLUMN "tempo" integer;--> statement-breakpoint
ALTER TABLE "arrangements" ADD COLUMN "time_signature" text;--> statement-breakpoint
CREATE UNIQUE INDEX "arrangements_song_slug_idx" ON "arrangements" USING btree ("song_id","slug");