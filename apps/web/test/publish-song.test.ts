import { describe, expect, it } from "vitest";
import { PublishSong, looksLikeChordPro } from "@/application/publish-song";
import type { Song, SongSummary } from "@/domain/song";
import type { NewSong, SongRepository } from "@/domain/song-repository";

/** In-memory adapter: the use case runs without a database. */
class InMemorySongRepository implements SongRepository {
  readonly songs: NewSong[] = [];

  async search(): Promise<SongSummary[]> {
    return this.songs;
  }

  async findBySlug(slug: string): Promise<Song | null> {
    const song = this.songs.find((s) => s.slug === slug);
    if (!song) return null;
    return {
      ...song,
      id: slug,
      arrangements: [{ id: "a", ...song.arrangement, createdAt: new Date(0) }],
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
}

const VALID = {
  title: "Canción de prueba",
  artist: "Él Mismo",
  key: "g",
  tempo: "92",
  timeSignature: "4/4",
  source: "G         D/F#\nCaminando por la calle",
  recordingUrls: ["https://youtu.be/dQw4w9WgXcQ", ""],
};

describe("PublishSong", () => {
  it("imports plain text, normalizes the key and stores the song", async () => {
    const repository = new InMemorySongRepository();
    const result = await new PublishSong(repository).execute({ ...VALID, key: "Bb" });

    expect(result).toEqual({ ok: true, slug: "cancion-de-prueba-el-mismo" });
    const stored = repository.songs[0];
    expect(stored?.originalKey).toBe("Bb");
    expect(stored?.tempo).toBe(92);
    expect(stored?.arrangement.chordpro).toBe("[G]Caminando [D/F#]por la calle");
    expect(stored?.recordings).toEqual([{ provider: "youtube", externalId: "dQw4w9WgXcQ" }]);
  });

  it("keeps ChordPro input as written", async () => {
    const repository = new InMemorySongRepository();
    await new PublishSong(repository).execute({ ...VALID, key: "G", source: "{soc}\n[G]Hola [C]mundo\n{eoc}" });
    expect(repository.songs[0]?.arrangement.chordpro).toBe("{soc}\n[G]Hola [C]mundo\n{eoc}");
  });

  it("makes slugs unique", async () => {
    const repository = new InMemorySongRepository();
    const publish = new PublishSong(repository);
    await publish.execute({ ...VALID, key: "G" });
    const second = await publish.execute({ ...VALID, key: "G" });
    expect(second).toEqual({ ok: true, slug: "cancion-de-prueba-el-mismo-2" });
  });

  it("rejects the song when a chord cannot be parsed", async () => {
    const repository = new InMemorySongRepository();
    const result = await new PublishSong(repository).execute({
      ...VALID,
      key: "C",
      source: "C   Hm   G   D\nla la la la",
    });
    expect(result).toEqual({ ok: false, errors: [{ field: "source", code: "unknown_chord", detail: "Hm (1)" }] });
    expect(repository.songs).toHaveLength(0);
  });

  it("reports every invalid field at once", async () => {
    const result = await new PublishSong(new InMemorySongRepository()).execute({
      title: " ",
      artist: "",
      key: "H",
      tempo: "999",
      timeSignature: "5/4",
      source: "",
      recordingUrls: ["https://example.com/song"],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => `${e.field}:${e.code}`)).toEqual([
      "title:required",
      "artist:required",
      "source:required",
      "key:invalid_key",
      "tempo:invalid_tempo",
      "timeSignature:invalid_time_signature",
      "recordings:invalid_recording_url",
    ]);
  });
});

describe("looksLikeChordPro", () => {
  it("treats bracketed section names as plain text", () => {
    expect(looksLikeChordPro("[Coro]\nG  D\nla la")).toBe(false);
    expect(looksLikeChordPro("[G]la [D]la")).toBe(true);
    expect(looksLikeChordPro("{title: X}\nla la")).toBe(true);
  });
});
