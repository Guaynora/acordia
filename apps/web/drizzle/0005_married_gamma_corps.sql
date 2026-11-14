-- Fuzzy, accent-insensitive song search. The extensions are also created by
-- docker/postgres/init for local databases; here they reach hosted ones too.
CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
-- unaccent() is only STABLE (it reads a dictionary), so it cannot back a
-- generated column or an index. Naming the dictionary explicitly makes the
-- result fixed, which is the usual way to wrap it as IMMUTABLE.
CREATE OR REPLACE FUNCTION acordia_unaccent(value text) RETURNS text
	LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
	AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, lower(value)) $$;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "search_text" text GENERATED ALWAYS AS (acordia_unaccent(title || ' ' || artist)) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX "songs_search_trgm_idx" ON "songs" USING gin ("search_text" gin_trgm_ops);
