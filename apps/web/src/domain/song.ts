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

export interface Arrangement {
  readonly id: string;
  /** Key the ChordPro source is written in. */
  readonly key: string;
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
}

export const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "6/8", "12/8"] as const;
export type TimeSignature = (typeof TIME_SIGNATURES)[number];

export const MIN_TEMPO = 30;
export const MAX_TEMPO = 300;
