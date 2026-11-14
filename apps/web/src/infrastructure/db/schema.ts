import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// --- Accounts ---------------------------------------------------------------
// Tables read and written by Better Auth (see infrastructure/auth). Keys are the
// field names Better Auth expects; columns follow the snake_case of the rest.

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const userRole = pgEnum("user_role", ["user", "moderator", "admin"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Public alias for /u/[handle]; lowercase, set when the account is created. */
  handle: text("handle").notNull().unique(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("user"),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The provider's id for the person (Google's "sub"). */
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (table) => [
    index("accounts_user_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_idx").on(table.providerId, table.accountId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

// --- Songs ------------------------------------------------------------------

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
    // Nullable: songs from before accounts have no owner, and deleting an
    // account keeps the songs it published.
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
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
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    /** Free-text credit from before accounts existed. */
    authorName: text("author_name"),
    key: text("key").notNull(),
    tempo: integer("tempo"),
    timeSignature: text("time_signature"),
    chordpro: text("chordpro").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("arrangements_song_idx").on(table.songId),
    index("arrangements_author_idx").on(table.authorId),
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
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("recordings_song_provider_external_idx").on(table.songId, table.provider, table.externalId)],
);

// --- Favorites --------------------------------------------------------------

/** Versions a person saved to practice. Private: only the owner sees them. */
export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    arrangementId: uuid("arrangement_id")
      .notNull()
      .references(() => arrangements.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.arrangementId] }),
    index("favorites_user_created_idx").on(table.userId, table.createdAt),
  ],
);
