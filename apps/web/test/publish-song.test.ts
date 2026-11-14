import { describe, expect, it } from "vitest";
import { PublishSong } from "@/application/publish-song";
import { looksLikeChordPro } from "@/application/song-input";
import { FakeRecordingInfo } from "./support/fake-recording-info";
import { InMemorySongRepository } from "./support/in-memory-song-repository";

const ACTOR = { id: "user-1", name: "Ana", role: "user" } as const;

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
    const result = await new PublishSong(repository, new FakeRecordingInfo()).execute({ ...VALID, key: "Bb" }, ACTOR);

    expect(result).toEqual({ ok: true, slug: "cancion-de-prueba-el-mismo" });
    const stored = repository.songs[0];
    expect(stored?.originalKey).toBe("Bb");
    expect(stored?.tempo).toBe(92);
    expect(stored?.arrangement.chordpro).toBe("[G]Caminando [D/F#]por la calle");
    expect(stored?.recordings).toEqual([
      {
        provider: "youtube",
        externalId: "dQw4w9WgXcQ",
        info: { title: "Title dQw4w9WgXcQ", authorName: "Channel", thumbnailUrl: null },
      },
    ]);
    expect(stored?.createdBy).toBe("user-1");
    expect(stored?.arrangement.authorId).toBe("user-1");
  });

  it("keeps ChordPro input as written", async () => {
    const repository = new InMemorySongRepository();
    await new PublishSong(repository, new FakeRecordingInfo()).execute({ ...VALID, key: "G", source: "{soc}\n[G]Hola [C]mundo\n{eoc}" }, ACTOR);
    expect(repository.songs[0]?.arrangement.chordpro).toBe("{soc}\n[G]Hola [C]mundo\n{eoc}");
  });

  it("makes slugs unique", async () => {
    const repository = new InMemorySongRepository();
    const publish = new PublishSong(repository, new FakeRecordingInfo());
    await publish.execute({ ...VALID, key: "G" }, ACTOR);
    const second = await publish.execute({ ...VALID, key: "G" }, ACTOR);
    expect(second).toEqual({ ok: true, slug: "cancion-de-prueba-el-mismo-2" });
  });

  it("rejects the song when a chord cannot be parsed", async () => {
    const repository = new InMemorySongRepository();
    const result = await new PublishSong(repository, new FakeRecordingInfo()).execute({
      ...VALID,
      key: "C",
      source: "C   Hm   G   D\nla la la la",
    }, ACTOR);
    expect(result).toEqual({ ok: false, errors: [{ field: "source", code: "unknown_chord", detail: "Hm (1)" }] });
    expect(repository.songs).toHaveLength(0);
  });

  it("requires a tempo", async () => {
    const result = await new PublishSong(new InMemorySongRepository(), new FakeRecordingInfo()).execute({ ...VALID, tempo: " " }, ACTOR);
    expect(result).toEqual({ ok: false, errors: [{ field: "tempo", code: "required" }] });
  });

  it("reports every invalid field at once", async () => {
    const result = await new PublishSong(new InMemorySongRepository(), new FakeRecordingInfo()).execute({
      title: " ",
      artist: "",
      key: "H",
      tempo: "999",
      timeSignature: "9/16",
      source: "",
      recordingUrls: ["https://example.com/song"],
    }, ACTOR);
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

describe("PublishSong recording lookups", () => {
  const LINKS = ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/AAAAAAAAAAA"];

  it("asks once per distinct recording and refuses links the provider does not know", async () => {
    const repository = new InMemorySongRepository();
    const info = new FakeRecordingInfo({ AAAAAAAAAAA: { status: "missing" } });
    const result = await new PublishSong(repository, info).execute({ ...VALID, recordingUrls: LINKS }, ACTOR);
    expect(info.asked).toEqual(["dQw4w9WgXcQ", "AAAAAAAAAAA"]);
    expect(result).toEqual({
      ok: false,
      errors: [{ field: "recordings", code: "recording_not_found", detail: "https://youtu.be/AAAAAAAAAAA" }],
    });
    expect(repository.songs).toHaveLength(0);
  });

  it("keeps the link without a title when the provider cannot be reached", async () => {
    const repository = new InMemorySongRepository();
    const info = new FakeRecordingInfo({ dQw4w9WgXcQ: { status: "unavailable" } });
    const result = await new PublishSong(repository, info).execute({ ...VALID, recordingUrls: LINKS.slice(0, 1) }, ACTOR);
    expect(result.ok).toBe(true);
    expect(repository.songs[0]?.recordings).toEqual([{ provider: "youtube", externalId: "dQw4w9WgXcQ", info: null }]);
  });

  it("does not ask providers when the form has other errors", async () => {
    const info = new FakeRecordingInfo();
    await new PublishSong(new InMemorySongRepository(), info).execute({ ...VALID, title: "" }, ACTOR);
    expect(info.asked).toEqual([]);
  });
});

describe("looksLikeChordPro", () => {
  it("treats bracketed section names as plain text", () => {
    expect(looksLikeChordPro("[Coro]\nG  D\nla la")).toBe(false);
    expect(looksLikeChordPro("[G]la [D]la")).toBe(true);
    expect(looksLikeChordPro("{title: X}\nla la")).toBe(true);
  });
});
