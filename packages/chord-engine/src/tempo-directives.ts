import { parseKey } from "./key";

/**
 * Directives that change the music from where they appear: tempo, meter,
 * key, accent grouping and tempo ramps. {tempo}, {time} and {key} are
 * standard ChordPro; what the standard lacks uses the x_ prefix, so other
 * apps still show the sheet.
 *
 *   {time: 7/8}
 *   {x_groups: 2+2+3}     accents on 1, 3 and 5
 *   {tempo: 140}
 *   {x_ramp: 140-120 4}   from 140 to 120 BPM over 4 bars
 *   {key: Ab}             the section modulates
 */
export type ChangeDirective = "tempo" | "time" | "key" | "x_groups" | "x_ramp";

export const CHANGE_DIRECTIVES: ReadonlySet<string> = new Set<ChangeDirective>([
  "tempo",
  "time",
  "key",
  "x_groups",
  "x_ramp",
]);

export interface TimeSignature {
  readonly beats: number;
  readonly unit: number;
}

export interface TempoRamp {
  readonly from: number;
  readonly to: number;
  readonly bars: number;
}

export function parseTempoValue(value: string): number | null {
  return /^\d{1,3}$/.test(value.trim()) ? Number(value.trim()) : null;
}

export function parseTimeSignature(value: string): TimeSignature | null {
  const match = /^(\d{1,2})\s*\/\s*(2|4|8)$/.exec(value.trim());
  if (!match) return null;
  const beats = Number(match[1]);
  return beats >= 1 ? { beats, unit: Number(match[2]) } : null;
}

/** "2+2+3" -> [2, 2, 3]. At least two groups, each 1-9. */
export function parseGroups(value: string): number[] | null {
  const parts = value.split("+").map((part) => part.trim());
  if (parts.length < 2 || !parts.every((part) => /^[1-9]$/.test(part))) return null;
  return parts.map(Number);
}

/** "140-120 4" -> from 140 to 120 BPM over 4 bars. */
export function parseRamp(value: string): TempoRamp | null {
  const match = /^(\d{1,3})\s*-\s*(\d{1,3})\s+(\d{1,3})$/.exec(value.trim());
  if (!match) return null;
  const bars = Number(match[3]);
  return bars >= 1 ? { from: Number(match[1]), to: Number(match[2]), bars } : null;
}

export type TempoDirectiveProblem =
  | "invalid_tempo"
  | "tempo_out_of_range"
  | "invalid_time"
  | "invalid_groups"
  | "groups_mismatch"
  | "invalid_ramp"
  | "invalid_key";

export interface TempoDirectiveError {
  /** 1-based line in the source. */
  readonly line: number;
  readonly directive: ChangeDirective;
  readonly value: string;
  readonly problem: TempoDirectiveProblem;
}

export interface TempoLimits {
  readonly minBpm: number;
  readonly maxBpm: number;
  /** Meter in force before any {time} directive, e.g. the song's "4/4". */
  readonly initialTime?: string;
}

const DIRECTIVE = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;

/**
 * Lists the change directives an author got wrong, so the upload can block
 * them like unknown chords. Groups must add up to the beats of the meter in
 * force where they appear.
 */
export function validateTempoDirectives(source: string, limits: TempoLimits): TempoDirectiveError[] {
  const errors: TempoDirectiveError[] = [];
  let time = limits.initialTime ? parseTimeSignature(limits.initialTime) : null;
  const inRange = (bpm: number) => bpm >= limits.minBpm && bpm <= limits.maxBpm;

  source.split("\n").forEach((text, index) => {
    const match = DIRECTIVE.exec(text);
    const directive = match?.[1]?.toLowerCase();
    if (!match || !directive || !CHANGE_DIRECTIVES.has(directive)) return;
    const name = directive as ChangeDirective;
    const value = match[2] ?? "";
    const fail = (problem: TempoDirectiveProblem) => errors.push({ line: index + 1, directive: name, value, problem });

    switch (name) {
      case "tempo": {
        const bpm = parseTempoValue(value);
        if (bpm === null) fail("invalid_tempo");
        else if (!inRange(bpm)) fail("tempo_out_of_range");
        break;
      }
      case "time": {
        const parsed = parseTimeSignature(value);
        if (parsed) time = parsed;
        else fail("invalid_time");
        break;
      }
      case "key":
        if (!parseKey(value)) fail("invalid_key");
        break;
      case "x_groups": {
        const groups = parseGroups(value);
        if (!groups) fail("invalid_groups");
        else if (time && groups.reduce((a, b) => a + b, 0) !== time.beats) fail("groups_mismatch");
        break;
      }
      case "x_ramp": {
        const ramp = parseRamp(value);
        if (!ramp) fail("invalid_ramp");
        else if (!inRange(ramp.from) || !inRange(ramp.to)) fail("tempo_out_of_range");
        break;
      }
    }
  });
  return errors;
}
