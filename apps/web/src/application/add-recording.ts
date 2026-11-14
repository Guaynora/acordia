import { parseRecordingUrl, type RecordingInfoProvider } from "@/domain/recording-url";
import type { SongRepository } from "@/domain/song-repository";
import type { Actor } from "@/domain/user";
import type { InputError } from "./song-input";

export interface AddRecordingInput {
  readonly songSlug: string;
  readonly url: string;
}

export type AddRecordingResult = { readonly ok: true } | { readonly ok: false; readonly errors: readonly InputError[] };

/**
 * Links a YouTube video or Spotify track to an existing song. Anyone signed
 * in may add one, and is recorded as having added it.
 */
export class AddRecording {
  constructor(
    private readonly songs: SongRepository,
    private readonly recordingInfo: RecordingInfoProvider,
  ) {}

  async execute(input: AddRecordingInput, actor: Actor): Promise<AddRecordingResult> {
    const fail = (code: InputError["code"], detail?: string): AddRecordingResult => ({
      ok: false,
      errors: [{ field: "recordings", code, ...(detail ? { detail } : {}) }],
    });
    const url = input.url.trim();
    const song = await this.songs.findBySlug(input.songSlug);
    if (!song) return fail("not_found");
    const reference = parseRecordingUrl(url);
    if (!reference) return fail(url ? "invalid_recording_url" : "required", url);
    if (song.recordings.some((r) => r.provider === reference.provider && r.externalId === reference.externalId)) {
      return fail("duplicate_recording", url);
    }

    const lookup = await this.recordingInfo.lookup(reference);
    if (lookup.status === "missing") return fail("recording_not_found", url);
    // An unreachable provider keeps the link, just without a title.
    const info = lookup.status === "found" ? lookup.info : null;
    const result = await this.songs.addRecording(song.id, { ...reference, info }, actor.id);
    return result === "added" ? { ok: true } : fail("duplicate_recording", url);
  }
}
