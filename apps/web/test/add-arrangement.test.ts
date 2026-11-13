import { beforeEach, describe, expect, it } from "vitest";
import { AddArrangement } from "@/application/add-arrangement";
import { PublishSong } from "@/application/publish-song";
import { InMemorySongRepository } from "./support/in-memory-song-repository";

const VERSION = {
  songSlug: "cielito-lindo-tradicional",
  name: "Rearmonización jazz",
  kind: "reharmonization",
  description: "Con dominantes secundarias",
  authorName: "Jonathan",
  key: "C",
  tempo: "",
  timeSignature: "",
  source: "Cmaj7    A7\nDe la Sierra Morena",
};

describe("AddArrangement", () => {
  let repository: InMemorySongRepository;
  let addArrangement: AddArrangement;

  beforeEach(async () => {
    repository = new InMemorySongRepository();
    addArrangement = new AddArrangement(repository);
    await new PublishSong(repository).execute({
      title: "Cielito lindo",
      artist: "Tradicional",
      key: "C",
      tempo: "120",
      timeSignature: "3/4",
      source: "C\nDe la Sierra Morena",
      recordingUrls: [],
    });
  });

  it("adds a version that inherits the song's tempo and meter", async () => {
    const result = await addArrangement.execute(VERSION);
    expect(result).toEqual({ ok: true, songSlug: "cielito-lindo-tradicional", arrangementSlug: "rearmonizacion-jazz" });

    const song = await repository.findBySlug("cielito-lindo-tradicional");
    expect(song?.arrangements.map((a) => a.slug)).toEqual(["original", "rearmonizacion-jazz"]);
    expect(song?.arrangements[1]).toMatchObject({
      name: "Rearmonización jazz",
      kind: "reharmonization",
      authorName: "Jonathan",
      tempo: null,
      timeSignature: null,
      chordpro: "[Cmaj7]De la Sie[A7]rra Morena",
    });
  });

  it("stores tempo and meter only when they change the feel", async () => {
    await addArrangement.execute({ ...VERSION, tempo: "120", timeSignature: "6/8" });
    const song = await repository.findBySlug("cielito-lindo-tradicional");
    expect(song?.arrangements[1]).toMatchObject({ tempo: null, timeSignature: "6/8" });
  });

  it("keeps version slugs unique within the song and avoids reserved words", async () => {
    await addArrangement.execute(VERSION);
    const second = await addArrangement.execute(VERSION);
    const reserved = await addArrangement.execute({ ...VERSION, name: "New" });
    expect(second).toMatchObject({ arrangementSlug: "rearmonizacion-jazz-2" });
    expect(reserved).toMatchObject({ arrangementSlug: "new-2" });
  });

  it("validates name, kind and chords", async () => {
    const result = await addArrangement.execute({ ...VERSION, name: " ", kind: "metal", source: "Hm\nla la" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => `${e.field}:${e.code}`)).toEqual(["name:required", "kind:invalid_kind", "source:unknown_chord"]);
  });

  it("fails for an unknown song", async () => {
    const result = await addArrangement.execute({ ...VERSION, songSlug: "nope" });
    expect(result).toEqual({ ok: false, errors: [{ field: "song", code: "not_found" }] });
  });
});
