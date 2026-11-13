import { formatKey, importChordsOverLyrics, parseChord, parseKey, validateChordPro } from "@acordia/chord-engine";
import { parseRecordingUrl, type RecordingReference } from "@/domain/recording-url";
import { slugify } from "@/domain/slug";
import { MAX_TEMPO, MIN_TEMPO, TIME_SIGNATURES } from "@/domain/song";
import type { SongRepository } from "@/domain/song-repository";

export interface PublishSongInput {
  readonly title: string;
  readonly artist: string;
  readonly key: string;
  readonly tempo: string;
  readonly timeSignature: string;
  readonly source: string;
  readonly recordingUrls: readonly string[];
}

export type PublishField = "title" | "artist" | "key" | "tempo" | "timeSignature" | "source" | "recordings";

export type PublishErrorCode =
  | "required"
  | "invalid_key"
  | "invalid_tempo"
  | "invalid_time_signature"
  | "unknown_chord"
  | "invalid_recording_url";

export interface PublishError {
  readonly field: PublishField;
  readonly code: PublishErrorCode;
  /** Extra context, such as the unknown chord and its line. */
  readonly detail?: string;
}

export type PublishSongResult =
  | { readonly ok: true; readonly slug: string }
  | { readonly ok: false; readonly errors: readonly PublishError[] };

/**
 * ChordPro marks chords in brackets. Plain "chords over lyrics" text may also
 * use brackets, but only for section names such as [Coro], which never parse
 * as chords.
 */
export function looksLikeChordPro(source: string): boolean {
  for (const match of source.matchAll(/\[([^\]]+)\]/g)) {
    if (parseChord(match[1] ?? "")) return true;
  }
  return /^\s*\{[a-z_]+.*\}\s*$/im.test(source);
}

/** Converts pasted text to ChordPro and lists any chords that did not parse. */
export function prepareSource(source: string, keyText: string) {
  const key = parseKey(keyText);
  if (looksLikeChordPro(source)) {
    return { chordpro: source, errors: key ? validateChordPro(source, key) : [] };
  }
  const imported = importChordsOverLyrics(source);
  return { chordpro: imported.chordpro, errors: imported.errors };
}

export class PublishSong {
  constructor(private readonly songs: SongRepository) {}

  async execute(input: PublishSongInput): Promise<PublishSongResult> {
    const errors: PublishError[] = [];
    const title = input.title.trim();
    const artist = input.artist.trim();
    const source = input.source.trim();

    if (!title) errors.push({ field: "title", code: "required" });
    if (!artist) errors.push({ field: "artist", code: "required" });
    if (!source) errors.push({ field: "source", code: "required" });

    const key = parseKey(input.key);
    if (!key) errors.push({ field: "key", code: "invalid_key" });

    const tempo = parseTempo(input.tempo);
    if (tempo === undefined) errors.push({ field: "tempo", code: "invalid_tempo" });

    const timeSignature = input.timeSignature.trim() || "4/4";
    if (!(TIME_SIGNATURES as readonly string[]).includes(timeSignature)) {
      errors.push({ field: "timeSignature", code: "invalid_time_signature" });
    }

    const recordings: RecordingReference[] = [];
    for (const url of input.recordingUrls.map((u) => u.trim()).filter(Boolean)) {
      const reference = parseRecordingUrl(url);
      if (reference) recordings.push(reference);
      else errors.push({ field: "recordings", code: "invalid_recording_url", detail: url });
    }

    const prepared = source && key ? prepareSource(source, input.key) : null;
    for (const chordError of prepared?.errors ?? []) {
      errors.push({ field: "source", code: "unknown_chord", detail: `${chordError.symbol} (${chordError.line})` });
    }

    if (errors.length > 0 || !key || !prepared || tempo === undefined) return { ok: false, errors };

    const slug = await this.uniqueSlug(slugify(title, artist) || "song");
    const keyName = formatKey(key);
    await this.songs.create({
      slug,
      title,
      artist,
      originalKey: keyName,
      tempo,
      timeSignature,
      arrangement: { key: keyName, chordpro: prepared.chordpro },
      recordings: dedupe(recordings),
    });
    return { ok: true, slug };
  }

  private async uniqueSlug(base: string): Promise<string> {
    let candidate = base;
    for (let n = 2; await this.songs.slugExists(candidate); n++) candidate = `${base}-${n}`;
    return candidate;
  }
}

/** Empty means "unknown" (null); anything else must be a whole number in range. */
function parseTempo(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value >= MIN_TEMPO && value <= MAX_TEMPO ? value : undefined;
}

function dedupe(recordings: RecordingReference[]): RecordingReference[] {
  const seen = new Set<string>();
  return recordings.filter((r) => {
    const id = `${r.provider}:${r.externalId}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
