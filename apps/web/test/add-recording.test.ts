import { beforeEach, describe, expect, it } from "vitest";
import { AddRecording } from "@/application/add-recording";
import { PublishSong } from "@/application/publish-song";
import { FakeRecordingInfo } from "./support/fake-recording-info";
import { InMemorySongRepository } from "./support/in-memory-song-repository";

const ANA = { id: "ana", name: "Ana", role: "user" } as const;
const LUIS = { id: "luis", name: "Luis", role: "user" } as const;
const SONG = "cielito-lindo-tradicional";

describe("AddRecording", () => {
  let repository: InMemorySongRepository;
  const recordings = async () => (await repository.findBySlug(SONG))?.recordings ?? [];

  beforeEach(async () => {
    repository = new InMemorySongRepository();
    await new PublishSong(repository, new FakeRecordingInfo()).execute(
      {
        title: "Cielito lindo",
        artist: "Tradicional",
        key: "C",
        tempo: "120",
        timeSignature: "3/4",
        source: "C\nDe la Sierra",
        recordingUrls: ["https://youtu.be/dQw4w9WgXcQ"],
      },
      ANA,
    );
  });

  it("links a video to a song that already exists", async () => {
    const result = await new AddRecording(repository, new FakeRecordingInfo()).execute(
      { songSlug: SONG, url: "https://www.youtube.com/watch?v=9bZkp7q19f0" },
      LUIS,
    );
    expect(result).toEqual({ ok: true });
    const added = (await recordings())[1];
    expect(added).toMatchObject({ provider: "youtube", externalId: "9bZkp7q19f0", title: "Title 9bZkp7q19f0" });
  });

  it("refuses a link the song already has", async () => {
    const result = await new AddRecording(repository, new FakeRecordingInfo()).execute(
      { songSlug: SONG, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      LUIS,
    );
    expect(result).toMatchObject({ ok: false, errors: [{ code: "duplicate_recording" }] });
    expect(await recordings()).toHaveLength(1);
  });

  it("refuses links that are not YouTube or Spotify, and videos that do not exist", async () => {
    const add = new AddRecording(
      repository,
      new FakeRecordingInfo({ gone0000000: { status: "missing" } }),
    );
    expect(await add.execute({ songSlug: SONG, url: "https://example.com/song" }, LUIS)).toMatchObject({
      ok: false,
      errors: [{ code: "invalid_recording_url" }],
    });
    expect(await add.execute({ songSlug: SONG, url: "https://youtu.be/gone0000000" }, LUIS)).toMatchObject({
      ok: false,
      errors: [{ code: "recording_not_found" }],
    });
    expect(await add.execute({ songSlug: "nope", url: "https://youtu.be/9bZkp7q19f0" }, LUIS)).toMatchObject({
      ok: false,
      errors: [{ code: "not_found" }],
    });
  });
});
