import { beforeEach, describe, expect, it } from "vitest";
import { AddArrangement } from "@/application/add-arrangement";
import { DeleteArrangement } from "@/application/delete-arrangement";
import { EditArrangement } from "@/application/edit-arrangement";
import { PublishSong } from "@/application/publish-song";
import { canManageArrangement } from "@/domain/permissions";
import { FakeRecordingInfo } from "./support/fake-recording-info";
import { InMemorySongRepository } from "./support/in-memory-song-repository";

const ANA = { id: "ana", name: "Ana", role: "user" } as const;
const LUIS = { id: "luis", name: "Luis", role: "user" } as const;
const MOD = { id: "mod", name: "Mod", role: "moderator" } as const;
const SONG = "cielito-lindo-tradicional";

const EDIT = {
  songSlug: SONG,
  arrangementSlug: "jazz",
  name: "Jazz reharm",
  kind: "reharmonization",
  description: "",
  key: "D",
  tempo: "",
  timeSignature: "",
  source: "Dmaj7\nDe la Sierra",
};

describe("canManageArrangement", () => {
  it("lets the author and moderators manage a version", () => {
    expect(canManageArrangement(ANA, { authorId: "ana" })).toBe(true);
    expect(canManageArrangement(LUIS, { authorId: "ana" })).toBe(false);
    expect(canManageArrangement(MOD, { authorId: "ana" })).toBe(true);
  });

  it("leaves versions from before accounts to moderators", () => {
    expect(canManageArrangement(ANA, { authorId: null })).toBe(false);
    expect(canManageArrangement({ ...ANA, role: "admin" }, { authorId: null })).toBe(true);
  });
});

describe("EditArrangement and DeleteArrangement", () => {
  let repository: InMemorySongRepository;

  beforeEach(async () => {
    repository = new InMemorySongRepository();
    await new PublishSong(repository, new FakeRecordingInfo()).execute(
      { title: "Cielito lindo", artist: "Tradicional", key: "C", tempo: "120", timeSignature: "3/4", source: "C\nDe la Sierra", recordingUrls: [] },
      ANA,
    );
    await new AddArrangement(repository).execute(
      { songSlug: SONG, name: "Jazz", kind: "reharmonization", description: "", key: "C", tempo: "", timeSignature: "", source: "Cmaj7\nDe la Sierra" },
      LUIS,
    );
  });

  const versions = async () => (await repository.findBySlug(SONG))?.arrangements ?? [];

  it("lets the author edit a version, keeping its URL", async () => {
    const result = await new EditArrangement(repository).execute({ ...EDIT, tempo: "90" }, LUIS);
    expect(result).toEqual({ ok: true, songSlug: SONG, arrangementSlug: "jazz", main: false });
    expect((await versions())[1]).toMatchObject({
      slug: "jazz",
      name: "Jazz reharm",
      key: "D",
      tempo: 90,
      timeSignature: null,
      chordpro: "[Dmaj7]De la Sierra",
    });
  });

  it("refuses edits from someone else", async () => {
    const result = await new EditArrangement(repository).execute(EDIT, ANA);
    expect(result).toEqual({ ok: false, errors: [{ field: "song", code: "forbidden" }] });
    expect((await versions())[1]?.name).toBe("Jazz");
  });

  it("updates the song's key, tempo and meter when the first version is edited", async () => {
    const result = await new EditArrangement(repository).execute(
      { ...EDIT, arrangementSlug: "original", name: "ignored", kind: "piano", key: "D", tempo: "100", timeSignature: "6/8" },
      ANA,
    );
    expect(result).toMatchObject({ ok: true, main: true });
    const song = await repository.findBySlug(SONG);
    expect(song).toMatchObject({ originalKey: "D", tempo: 100, timeSignature: "6/8" });
    expect(song?.arrangements[0]).toMatchObject({ name: "Original", kind: "original", key: "D", tempo: null });
  });

  it("requires a tempo for the first version", async () => {
    const result = await new EditArrangement(repository).execute({ ...EDIT, arrangementSlug: "original" }, ANA);
    expect(result).toEqual({ ok: false, errors: [{ field: "tempo", code: "required" }] });
  });

  it("deletes a version but keeps the song", async () => {
    const result = await new DeleteArrangement(repository).execute({ songSlug: SONG, arrangementSlug: "jazz" }, LUIS);
    expect(result).toEqual({ ok: true, songSlug: SONG, songDeleted: false });
    expect((await versions()).map((a) => a.slug)).toEqual(["original"]);
  });

  it("keeps the original while other versions exist", async () => {
    const result = await new DeleteArrangement(repository).execute({ songSlug: SONG, arrangementSlug: "original" }, ANA);
    expect(result).toEqual({ ok: false, errors: [{ field: "song", code: "original_has_versions" }] });
  });

  it("deletes the whole song with its last version", async () => {
    const remove = new DeleteArrangement(repository);
    await remove.execute({ songSlug: SONG, arrangementSlug: "jazz" }, MOD);
    const result = await remove.execute({ songSlug: SONG, arrangementSlug: "original" }, ANA);
    expect(result).toEqual({ ok: true, songSlug: SONG, songDeleted: true });
    expect(await repository.findBySlug(SONG)).toBeNull();
  });

  it("refuses deletes from someone else and for unknown versions", async () => {
    const remove = new DeleteArrangement(repository);
    expect(await remove.execute({ songSlug: SONG, arrangementSlug: "jazz" }, ANA)).toMatchObject({
      errors: [{ code: "forbidden" }],
    });
    expect(await remove.execute({ songSlug: SONG, arrangementSlug: "nope" }, ANA)).toMatchObject({
      errors: [{ code: "not_found" }],
    });
  });
});
