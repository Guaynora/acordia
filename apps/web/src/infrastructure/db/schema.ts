import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const recordingProvider = pgEnum("recording_provider", ["youtube", "spotify"]);
export const arrangementKind = pgEnum("arrangement_kind", [
  "original",
  "simplified",
  "reharmonization",
  "acoustic",
  "piano",
  "other",
]);

export const songs = pgTable(
  "songs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    originalKey: text("original_key").notNull(),
    tempo: integer("tempo"),
    timeSignature: text("time_signature").notNull().default("4/4"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("songs_slug_idx").on(table.slug)],
);

export const arrangements = pgTable(
  "arrangements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    // Defaults backfill the arrangements created before versions existed.
    slug: text("slug").notNull().default("original"),
    name: text("name").notNull().default("Original"),
    kind: arrangementKind("kind").notNull().default("original"),
    description: text("description"),
    authorName: text("author_name"),
    key: text("key").notNull(),
    tempo: integer("tempo"),
    timeSignature: text("time_signature"),
    chordpro: text("chordpro").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("arrangements_song_idx").on(table.songId),
    uniqueIndex("arrangements_song_slug_idx").on(table.songId, table.slug),
  ],
);

export const recordings = pgTable(
  "recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    provider: recordingProvider("provider").notNull(),
    externalId: text("external_id").notNull(),
    key: text("key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("recordings_song_provider_external_idx").on(table.songId, table.provider, table.externalId)],
);
