import type { Arrangement, Song, SongSummary } from "@/domain/song";
import type { NewArrangement, NewSong, SongRepository } from "@/domain/song-repository";

/** The fields a stored song exposes, without the owner (not part of the read model). */
function summaryFields(song: NewSong) {
  const { slug, title, artist, originalKey, tempo, timeSignature } = song;
  return { slug, title, artist, originalKey, tempo, timeSignature };
}

/** In-memory adapter: use cases run in tests without a database. */
export class InMemorySongRepository implements SongRepository {
  readonly songs: NewSong[] = [];
  readonly extraArrangements = new Map<string, NewArrangement[]>();

  async search(): Promise<SongSummary[]> {
    return this.songs.map((s) => ({ ...summaryFields(s), arrangementCount: 1 + (this.extraArrangements.get(s.slug)?.length ?? 0) }));
  }

  async findBySlug(slug: string): Promise<Song | null> {
    const song = this.songs.find((s) => s.slug === slug);
    if (!song) return null;
    const all = [song.arrangement, ...(this.extraArrangements.get(slug) ?? [])];
    return {
      ...summaryFields(song),
      id: slug,
      arrangements: all.map((a, i): Arrangement => ({ ...a, id: String(i), authorName: null, createdAt: new Date(i) })),
      recordings: song.recordings.map((r, i) => ({ id: String(i), ...r, key: null })),
    };
  }

  async slugExists(slug: string): Promise<boolean> {
    return this.songs.some((s) => s.slug === slug);
  }

  async create(song: NewSong): Promise<Song> {
    this.songs.push(song);
    const created = await this.findBySlug(song.slug);
    if (!created) throw new Error("unreachable");
    return created;
  }

  async addArrangement(songId: string, arrangement: NewArrangement): Promise<void> {
    // findBySlug uses the slug as id.
    this.extraArrangements.set(songId, [...(this.extraArrangements.get(songId) ?? []), arrangement]);
  }
}
