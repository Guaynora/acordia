import { type RecordingInfoProvider, type RecordingReference, parseRecordingUrl } from "@/domain/recording-url";
import { slugify } from "@/domain/slug";
import type { NewRecording, SongRepository } from "@/domain/song-repository";
import type { Actor } from "@/domain/user";
import { type InputError, validateMusic } from "./song-input";

export interface PublishSongInput {
  readonly title: string;
  readonly artist: string;
  readonly key: string;
  readonly tempo: string;
  readonly timeSignature: string;
  readonly source: string;
  readonly recordingUrls: readonly string[];
}

export type PublishSongResult =
  | { readonly ok: true; readonly slug: string }
  | { readonly ok: false; readonly errors: readonly InputError[] };

/** Creates a song together with its first ("Original") arrangement. */
export class PublishSong {
  constructor(
    private readonly songs: SongRepository,
    private readonly recordingInfo: RecordingInfoProvider,
  ) {}

  async execute(input: PublishSongInput, actor: Actor): Promise<PublishSongResult> {
    const errors: InputError[] = [];
    const title = input.title.trim();
    const artist = input.artist.trim();

    if (!title) errors.push({ field: "title", code: "required" });
    if (!artist) errors.push({ field: "artist", code: "required" });

    const { errors: musicErrors, music } = validateMusic(input, { optionalMeter: false });
    errors.push(...musicErrors);

    const links: { url: string; reference: RecordingReference }[] = [];
    for (const url of input.recordingUrls.map((u) => u.trim()).filter(Boolean)) {
      const reference = parseRecordingUrl(url);
      if (reference) links.push({ url, reference });
      else errors.push({ field: "recordings", code: "invalid_recording_url", detail: url });
    }

    if (errors.length > 0 || !music) return { ok: false, errors };

    // Ask the providers only once the rest of the form is valid.
    const recordings: NewRecording[] = [];
    const lookups = await Promise.all(dedupe(links).map(async (link) => ({ link, result: await this.recordingInfo.lookup(link.reference) })));
    for (const { link, result } of lookups) {
      if (result.status === "missing") {
        errors.push({ field: "recordings", code: "recording_not_found", detail: link.url });
      } else {
        // Unreachable provider: keep the link, just without a title.
        recordings.push({ ...link.reference, info: result.status === "found" ? result.info : null });
      }
    }
    if (errors.length > 0) return { ok: false, errors };

    const slug = await this.uniqueSlug(slugify(title, artist) || "song");
    await this.songs.create({
      slug,
      title,
      artist,
      originalKey: music.key,
      tempo: music.tempo,
      timeSignature: music.timeSignature ?? "4/4",
      createdBy: actor.id,
      arrangement: {
        slug: "original",
        name: "Original",
        kind: "original",
        description: null,
        authorId: actor.id,
        key: music.key,
        // The song itself carries tempo and meter; the original inherits them.
        tempo: null,
        timeSignature: null,
        chordpro: music.chordpro,
      },
      recordings,
    });
    return { ok: true, slug };
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    for (let n = 2; await this.songs.slugExists(candidate); n++) candidate = `${base}-${n}`;
    return candidate;
  }
}

function dedupe<T extends { reference: RecordingReference }>(links: T[]): T[] {
  const seen = new Set<string>();
  return links.filter(({ reference: r }) => {
    const id = `${r.provider}:${r.externalId}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
