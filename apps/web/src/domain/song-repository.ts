import type { RecordingReference } from "./recording-url";
import type { Song, SongSummary } from "./song";

export interface NewSong {
  readonly slug: string;
  readonly title: string;
  readonly artist: string;
  readonly originalKey: string;
  readonly tempo: number | null;
  readonly timeSignature: string;
  readonly arrangement: { readonly key: string; readonly chordpro: string };
  readonly recordings: readonly RecordingReference[];
}

/** Port implemented by the infrastructure layer. */
export interface SongRepository {
  search(query: string, limit: number): Promise<SongSummary[]>;
  findBySlug(slug: string): Promise<Song | null>;
  slugExists(slug: string): Promise<boolean>;
  create(song: NewSong): Promise<Song>;
}
