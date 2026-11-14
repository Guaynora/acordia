import type { Arrangement, Song, SongSummary } from "@/domain/song";
import type {
  ArrangementChanges,
  NewArrangement,
  NewSong,
  SongMusicChanges,
  SongRepository,
} from "@/domain/song-repository";

interface StoredSong {
  id: string;
  song: Omit<NewSong, "arrangement">;
  arrangements: (NewArrangement & { id: string })[];
}

/** In-memory adapter: use cases run in tests without a database. */
export class InMemorySongRepository implements SongRepository {
  private readonly stored: StoredSong[] = [];
  private nextId = 1;

  /** Songs as they were created, for assertions. */
  get songs(): (NewSong & { arrangements: NewArrangement[] })[] {
    return this.stored.map((s) => ({ ...s.song, arrangement: s.arrangements[0]!, arrangements: s.arrangements }));
  }

  async search(): Promise<SongSummary[]> {
    return this.stored.map(({ song: s, arrangements }) => ({
      slug: s.slug,
      title: s.title,
      artist: s.artist,
      originalKey: s.originalKey,
      tempo: s.tempo,
      timeSignature: s.timeSignature,
      arrangementCount: arrangements.length,
    }));
  }

  async findBySlug(slug: string): Promise<Song | null> {
    const found = this.stored.find((s) => s.song.slug === slug);
    if (!found) return null;
    const { song: s } = found;
    return {
      id: found.id,
      slug: s.slug,
      title: s.title,
      artist: s.artist,
      originalKey: s.originalKey,
      tempo: s.tempo,
      timeSignature: s.timeSignature,
      arrangements: found.arrangements.map(
        (a, i): Arrangement => ({ ...a, authorName: null, authorHandle: null, createdAt: new Date(i) }),
      ),
      recordings: s.recordings.map((r, i) => ({ id: String(i), ...r, key: null })),
    };
  }

  async slugExists(slug: string): Promise<boolean> {
    return this.stored.some((s) => s.song.slug === slug);
  }

  async create(input: NewSong): Promise<Song> {
    const { arrangement, ...song } = input;
    this.stored.push({ id: this.id(), song, arrangements: [{ ...arrangement, id: this.id() }] });
    const created = await this.findBySlug(input.slug);
    if (!created) throw new Error("unreachable");
    return created;
  }

  async addArrangement(songId: string, arrangement: NewArrangement): Promise<void> {
    this.byId(songId).arrangements.push({ ...arrangement, id: this.id() });
  }

  async updateArrangement(
    arrangementId: string,
    changes: ArrangementChanges,
    song: { id: string; changes: SongMusicChanges } | null,
  ): Promise<void> {
    for (const s of this.stored) {
      const index = s.arrangements.findIndex((a) => a.id === arrangementId);
      const current = s.arrangements[index];
      if (current) s.arrangements[index] = { ...current, ...changes };
    }
    if (song) {
      const target = this.byId(song.id);
      target.song = { ...target.song, ...song.changes };
    }
  }

  async deleteArrangement(arrangementId: string): Promise<void> {
    for (const s of this.stored) s.arrangements = s.arrangements.filter((a) => a.id !== arrangementId);
  }

  async deleteSong(songId: string): Promise<void> {
    const index = this.stored.findIndex((s) => s.id === songId);
    if (index >= 0) this.stored.splice(index, 1);
  }

  private byId(songId: string): StoredSong {
    const found = this.stored.find((s) => s.id === songId);
    if (!found) throw new Error(`No song ${songId}`);
    return found;
  }

  private id(): string {
    return String(this.nextId++);
  }
}
