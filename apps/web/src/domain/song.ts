/**
 * Core entities. Plain data with no knowledge of the database, Next.js or
 * external services.
 */

export type RecordingProvider = "youtube" | "spotify";

export interface Recording {
  readonly id: string;
  readonly provider: RecordingProvider;
  readonly externalId: string;
  /** Key the recording is played in, when it differs from the song's. */
  readonly key: string | null;
}

export const ARRANGEMENT_KINDS = ["original", "simplified", "reharmonization", "acoustic", "piano", "other"] as const;
export type ArrangementKind = (typeof ARRANGEMENT_KINDS)[number];

/**
 * One way of playing a song: the original chords, a simplified version, a
 * reharmonization... A song always has at least one.
 */
export interface Arrangement {
  readonly id: string;
  /** Unique within the song; used in the URL. */
  readonly slug: string;
  readonly name: string;
  readonly kind: ArrangementKind;
  readonly description: string | null;
  /** Account that published this version; null for versions from before accounts. */
  readonly authorId: string | null;
  /** The author's current display name, or the free-text name older versions carried. */
  readonly authorName: string | null;
  /** Key the ChordPro source is written in. */
  readonly key: string;
  /** Overrides the song's tempo and meter when the arrangement changes the feel. */
  readonly tempo: number | null;
  readonly timeSignature: string | null;
  readonly chordpro: string;
  readonly createdAt: Date;
}

export interface Song {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly artist: string;
  readonly originalKey: string;
  readonly tempo: number | null;
  readonly timeSignature: string;
  readonly arrangements: readonly Arrangement[];
  readonly recordings: readonly Recording[];
}

export interface SongSummary {
  readonly slug: string;
  readonly title: string;
  readonly artist: string;
  readonly originalKey: string;
  readonly tempo: number | null;
  readonly timeSignature: string;
  readonly arrangementCount: number;
}

/** Slugs that collide with routes under /songs/[slug]/. */
export const RESERVED_ARRANGEMENT_SLUGS = new Set(["new"]);

export { TIME_SIGNATURES } from "./meter";

export const MIN_TEMPO = 30;
export const MAX_TEMPO = 300;
