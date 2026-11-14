import type { RecordingReference } from "./recording-url";
import type { ArrangementKind, Song, SongSummary } from "./song";

export interface NewArrangement {
  readonly slug: string;
  readonly name: string;
  readonly kind: ArrangementKind;
  readonly description: string | null;
  readonly authorId: string;
  readonly key: string;
  readonly tempo: number | null;
  readonly timeSignature: string | null;
  readonly chordpro: string;
}

export interface NewSong {
  readonly slug: string;
  readonly title: string;
  readonly artist: string;
  readonly originalKey: string;
  readonly tempo: number | null;
  readonly timeSignature: string;
  /** Account that publishes the song; also credited for its recordings. */
  readonly createdBy: string;
  readonly arrangement: NewArrangement;
  readonly recordings: readonly RecordingReference[];
}

/** Port implemented by the infrastructure layer. */
export interface SongRepository {
  search(query: string, limit: number): Promise<SongSummary[]>;
  findBySlug(slug: string): Promise<Song | null>;
  slugExists(slug: string): Promise<boolean>;
  create(song: NewSong): Promise<Song>;
  addArrangement(songId: string, arrangement: NewArrangement): Promise<void>;
}
