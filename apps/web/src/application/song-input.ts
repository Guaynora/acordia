import {
  formatKey,
  importChordsOverLyrics,
  parseChord,
  parseKey,
  validateChordPro,
  validateStructure,
  validateTempoDirectives,
} from "@acordia/chord-engine";
import { MAX_TEMPO, MIN_TEMPO, TIME_SIGNATURES } from "@/domain/song";

/**
 * Validation shared by "publish a song" and "add a version": the musical
 * part of a form (key, tempo, meter and the pasted chords).
 */

export type InputField =
  | "song"
  | "title"
  | "artist"
  | "name"
  | "kind"
  | "key"
  | "tempo"
  | "timeSignature"
  | "source"
  | "recordings";

export type InputErrorCode =
  | "required"
  | "not_found"
  | "forbidden"
  | "original_has_versions"
  | "invalid_kind"
  | "invalid_key"
  | "invalid_tempo"
  | "invalid_time_signature"
  | "unknown_chord"
  | "invalid_directive"
  | "duplicate_recording"
  | "invalid_recording_url"
  | "recording_not_found";

export interface InputError {
  readonly field: InputField;
  readonly code: InputErrorCode;
  /** Extra context, such as the unknown chord and its line. */
  readonly detail?: string;
}

/**
 * ChordPro marks chords in brackets. Plain "chords over lyrics" text may also
 * use brackets, but only for section names such as [Coro], which never parse
 * as chords. Directives ({tempo: 140}) do not decide it: the importer keeps
 * them as they are, so pasted chords-over-lyrics text can change tempo,
 * meter or key by section too.
 */
export function looksLikeChordPro(source: string): boolean {
  for (const match of source.matchAll(/\[([^\]]+)\]/g)) {
    if (parseChord(match[1] ?? "")) return true;
  }
  return false;
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

/** Accepts lowercase input such as "g", "am" or "bb". */
export function normalizeKeyInput(text: string): string {
  return text.trim().replace(/^[a-g]/, (letter) => letter.toUpperCase());
}

/** Null when empty, undefined when invalid, otherwise a whole number in range. */
export function parseTempo(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return value >= MIN_TEMPO && value <= MAX_TEMPO ? value : undefined;
}

export interface MusicInput {
  readonly key: string;
  readonly tempo: string;
  readonly timeSignature: string;
  readonly source: string;
}

export interface Music {
  readonly key: string;
  readonly tempo: number | null;
  readonly timeSignature: string | null;
  readonly chordpro: string;
}

/**
 * Validates the musical fields. With `optionalMeter`, an empty tempo or time
 * signature means "inherit from the song" and comes back as null.
 */
export function validateMusic(
  input: MusicInput,
  options: { readonly optionalMeter: boolean },
): { readonly errors: InputError[]; readonly music: Music | null } {
  const errors: InputError[] = [];
  const source = input.source.trim();
  if (!source) errors.push({ field: "source", code: "required" });

  const keyText = normalizeKeyInput(input.key);
  const key = parseKey(keyText);
  if (!key) errors.push({ field: "key", code: "invalid_key" });

  const tempo = parseTempo(input.tempo);
  if (tempo === null && !options.optionalMeter) errors.push({ field: "tempo", code: "required" });
  if (tempo === undefined) errors.push({ field: "tempo", code: "invalid_tempo" });

  const meterText = input.timeSignature.trim();
  const timeSignature = meterText || (options.optionalMeter ? null : "4/4");
  if (timeSignature !== null && !(TIME_SIGNATURES as readonly string[]).includes(timeSignature)) {
    errors.push({ field: "timeSignature", code: "invalid_time_signature" });
  }

  const prepared = source && key ? prepareSource(source, keyText) : null;
  for (const chordError of prepared?.errors ?? []) {
    errors.push({ field: "source", code: "unknown_chord", detail: `${chordError.symbol} (${chordError.line})` });
  }
  // Tempo, meter, key, grouping and ramp changes inside the sheet.
  const limits = { minBpm: MIN_TEMPO, maxBpm: MAX_TEMPO, initialTime: timeSignature ?? "4/4" };
  for (const problem of prepared ? validateTempoDirectives(prepared.chordpro, limits) : []) {
    const directive = `{${problem.directive}: ${problem.value}}`;
    errors.push({ field: "source", code: "invalid_directive", detail: `${directive} (${problem.line})` });
  }
  // Repeats, endings and D.S./D.C. jumps.
  for (const problem of prepared ? validateStructure(prepared.chordpro) : []) {
    errors.push({ field: "source", code: "invalid_directive", detail: `${problem.text} (${problem.line})` });
  }

  if (errors.length > 0 || !key || !prepared || tempo === undefined) return { errors, music: null };
  return {
    errors,
    music: { key: formatKey(key), tempo, timeSignature, chordpro: prepared.chordpro },
  };
}

export function optionalText(text: string, maxLength: number): string | null {
  const trimmed = text.trim().slice(0, maxLength);
  return trimmed === "" ? null : trimmed;
}
