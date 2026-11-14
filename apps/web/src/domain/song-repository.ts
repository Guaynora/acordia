import type { RecordingInfo, RecordingReference } from "./recording-url";
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

export type NewRecording = RecordingReference & { readonly info: RecordingInfo | null };

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
  readonly recordings: readonly NewRecording[];
}

/** Fields of a version that an edit can change; its slug and author never change. */
export type ArrangementChanges = Omit<NewArrangement, "slug" | "authorId">;

/** Song-level music, edited together with the song's first version. */
export interface SongMusicChanges {
  readonly originalKey: string;
  readonly tempo: number | null;
  readonly timeSignature: string;
}

/** Port implemented by the infrastructure layer. */
export interface SongRepository {
  search(query: string, limit: number): Promise<SongSummary[]>;
  findBySlug(slug: string): Promise<Song | null>;
  slugExists(slug: string): Promise<boolean>;
  create(song: NewSong): Promise<Song>;
  addArrangement(songId: string, arrangement: NewArrangement): Promise<void>;
  /** Saves both in one transaction; `song` is null when only the version changes. */
  updateArrangement(arrangementId: string, changes: ArrangementChanges, song: { id: string; changes: SongMusicChanges } | null): Promise<void>;
  deleteArrangement(arrangementId: string): Promise<void>;
  /** Deletes the song with its versions and recordings. */
  deleteSong(songId: string): Promise<void>;
  /** Links a video or track to a song; "duplicate" when the song already has it. */
  addRecording(songId: string, recording: NewRecording, addedBy: string): Promise<"added" | "duplicate">;
}
