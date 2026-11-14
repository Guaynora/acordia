-- Public profile alias. Existing accounts get one derived from their name
-- (same rules as domain/handle.ts), with -2, -3... for repeated names.
ALTER TABLE "users" ADD COLUMN "handle" text;--> statement-breakpoint
WITH bases AS (
	SELECT
		"id",
		coalesce(
			nullif(trim(BOTH '-' FROM left(trim(BOTH '-' FROM regexp_replace(lower(unaccent("name")), '[^a-z0-9]+', '-', 'g')), 30)), ''),
			'musico'
		) AS base,
		row_number() OVER (
			PARTITION BY coalesce(
				nullif(trim(BOTH '-' FROM left(trim(BOTH '-' FROM regexp_replace(lower(unaccent("name")), '[^a-z0-9]+', '-', 'g')), 30)), ''),
				'musico'
			)
			ORDER BY "created_at", "id"
		) AS n
	FROM "users"
)
UPDATE "users" SET "handle" = CASE WHEN bases.n = 1 THEN bases.base ELSE bases.base || '-' || bases.n END
FROM bases
WHERE "users"."id" = bases."id";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "handle" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_handle_unique" UNIQUE("handle");
