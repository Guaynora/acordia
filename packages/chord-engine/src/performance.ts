import type { SongLine } from "./song";

/**
 * The order a song is played in, as opposed to the order it is written:
 * repeats, first and second endings, whole sections marked "x2", and
 * D.S. / D.C. jumps.
 *
 *   |: ... :|           repeat these lines (":|x3" for three times); without
 *                       "|:", from the start of the section
 *   Coro x2:            play the whole section twice
 *   {x_ending: 1}       the lines from here to ":|" are the first ending;
 *   {x_ending: 2}       the lines after it, the second
 *   {x_segno} {x_coda} {x_to_coda} {x_fine}           marks
 *   {x_ds_al_coda} {x_dc_al_coda} {x_ds_al_fine} {x_dc_al_fine}   jumps
 *
 * Repeats work on whole lines, the way chord sheets write them. After a
 * D.S. or D.C., repeats play once and take their last ending.
 */

export type MarkerDirective =
  | "x_ending"
  | "x_segno"
  | "x_coda"
  | "x_to_coda"
  | "x_fine"
  | "x_ds_al_coda"
  | "x_dc_al_coda"
  | "x_ds_al_fine"
  | "x_dc_al_fine";

export const MARKER_DIRECTIVES: ReadonlySet<string> = new Set<MarkerDirective>([
  "x_ending",
  "x_segno",
  "x_coda",
  "x_to_coda",
  "x_fine",
  "x_ds_al_coda",
  "x_dc_al_coda",
  "x_ds_al_fine",
  "x_dc_al_fine",
]);

const MAX_TIMES = 16;
/** "|:" opens a repeat. */
const REPEAT_START = /\|:/;
/** ":|", ":|x3", ":| x3" or ":| (x3)" closes one. */
const REPEAT_END = /:\|(?:\s*\(?\s*[x×]\s*(\d+)\s*\)?)?/i;
/** A section name ending in "x2", "x 2" or "(x2)" plays that many times. */
const SECTION_TIMES = /\S\s+\(?[x×]\s*(\d+)\)?\s*$/i;

/** Ending numbers: "1", "2.", "1,2" or "1-2". */
export function parseEndingNumbers(value: string): number[] | null {
  const trimmed = value.trim().replace(/\.$/, "");
  const range = /^(\d)\s*-\s*(\d)$/.exec(trimmed);
  if (range) {
    const [from, to] = [Number(range[1]), Number(range[2])];
    return from >= 1 && from <= to ? Array.from({ length: to - from + 1 }, (_, i) => from + i) : null;
  }
  if (!/^\d(\s*[,.]\s*\d)*$/.test(trimmed)) return null;
  const numbers = trimmed.split(/\s*[,.]\s*/).map(Number);
  return numbers.every((n) => n >= 1) ? numbers : null;
}

/** How many times ":|" asks for, or null when the line closes no repeat. */
export function repeatEndTimes(text: string): number | null {
  const match = REPEAT_END.exec(text);
  if (!match) return null;
  return match[1] ? Number(match[1]) : 2;
}

export function sectionTimes(label: string | null): number {
  const match = label ? SECTION_TIMES.exec(label) : null;
  return match ? Number(match[1]) : 1;
}

const lineText = (line: SongLine) =>
  line.kind === "lyrics" ? line.segments.map((s) => s.text).join("") : "";

const isSectionBoundary = (line: SongLine) =>
  line.kind === "section-start" || line.kind === "section-end" || line.kind === "comment";

interface Repeat {
  readonly start: number;
  readonly end: number;
  readonly times: number;
}

interface Ending {
  readonly repeat: Repeat;
  readonly numbers: ReadonlySet<number>;
  /** Last line of this ending. */
  readonly last: number;
}

/** Where each section-like block starts, for repeats without "|:". */
function sectionStartBefore(lines: readonly SongLine[], index: number): number {
  for (let i = index; i >= 0; i--) {
    const line = lines[i];
    if (line && (line.kind === "section-start" || line.kind === "comment")) return i;
    if (line?.kind === "section-end" && i < index) return i + 1;
  }
  return 0;
}

function findRepeats(lines: readonly SongLine[]): Repeat[] {
  const repeats: Repeat[] = [];
  const open: number[] = [];

  lines.forEach((line, index) => {
    const text = lineText(line);
    if (REPEAT_START.test(text)) open.push(index);
    const times = repeatEndTimes(text);
    if (times !== null) {
      const start = open.pop() ?? sectionStartBefore(lines, index);
      repeats.push({ start, end: index, times: Math.min(Math.max(times, 1), MAX_TIMES) });
    }

    // Whole sections marked "x2".
    const label = line.kind === "section-start" ? line.label : line.kind === "comment" ? line.text : null;
    const sectionRepeat = sectionTimes(label);
    if (sectionRepeat > 1) {
      let end = lines.length - 1;
      for (let i = index + 1; i < lines.length; i++) {
        const next = lines[i];
        if (!next) continue;
        if (line.kind === "section-start" && next.kind === "section-end") {
          end = i;
          break;
        }
        if (line.kind === "comment" && isSectionBoundary(next)) {
          end = i - 1;
          break;
        }
      }
      repeats.push({ start: index, end, times: Math.min(sectionRepeat, MAX_TIMES) });
    }
  });
  return repeats;
}

/** Endings inside a repeat; the last ending, after ":|", needs no handling. */
function findEndings(lines: readonly SongLine[], repeats: readonly Repeat[]): Map<number, Ending> {
  const markers = lines.flatMap((line, index) =>
    line.kind === "marker" && line.directive === "x_ending" ? [{ index, numbers: parseEndingNumbers(line.value) }] : [],
  );
  const endings = new Map<number, Ending>();
  markers.forEach(({ index, numbers }, m) => {
    if (!numbers) return;
    // The innermost repeat holding this marker.
    const repeat = repeats
      .filter((r) => r.start <= index && index <= r.end)
      .sort((a, b) => b.start - a.start)[0];
    if (!repeat) return;
    const next = markers[m + 1]?.index;
    const last = next !== undefined && next <= repeat.end ? next - 1 : repeat.end;
    endings.set(index, { repeat, numbers: new Set(numbers), last });
  });
  return endings;
}

/** Indices into `lines`, in the order they are played. */
export function performanceOrder(lines: readonly SongLine[]): number[] {
  const repeats = findRepeats(lines);
  const endings = findEndings(lines, repeats);
  const markerAt = (directive: MarkerDirective) =>
    lines.findIndex((line) => line.kind === "marker" && line.directive === directive);
  const segno = markerAt("x_segno");
  const coda = markerAt("x_coda");

  // Times each repeat has started its current pass (0 = not playing).
  const pass = new Map<Repeat, number>();
  let jumped: "coda" | "fine" | null = null;
  const order: number[] = [];

  let i = 0;
  for (let guard = 0; i < lines.length && guard < 100_000; guard++) {
    const ending = endings.get(i);
    if (ending) {
      const current = jumped ? ending.repeat.times : pass.get(ending.repeat) || 1;
      if (!ending.numbers.has(current)) {
        if (ending.last >= ending.repeat.end) pass.set(ending.repeat, 0);
        i = ending.last + 1;
        continue;
      }
    }

    for (const repeat of repeats) {
      if (repeat.start === i && !pass.get(repeat)) pass.set(repeat, jumped ? repeat.times : 1);
    }

    order.push(i);
    const line = lines[i];

    if (line?.kind === "marker") {
      const { directive } = line;
      const isJump = directive.startsWith("x_ds_") || directive.startsWith("x_dc_");
      if (isJump && !jumped) {
        const target = directive.startsWith("x_ds_") ? segno : 0;
        if (target >= 0) {
          jumped = directive.endsWith("coda") ? "coda" : "fine";
          pass.clear();
          i = target;
          continue;
        }
      }
      if (directive === "x_to_coda" && jumped === "coda" && coda >= 0) {
        i = coda;
        continue;
      }
      if (directive === "x_fine" && jumped === "fine") break;
    }

    // Close the repeats ending here, innermost first; the first that loops wins.
    let looped = false;
    for (const repeat of repeats.filter((r) => r.end === i).sort((a, b) => b.start - a.start)) {
      const current = pass.get(repeat) || (jumped ? repeat.times : 1);
      if (current < repeat.times) {
        pass.set(repeat, current + 1);
        i = repeat.start;
        looped = true;
        break;
      }
      pass.set(repeat, 0);
    }
    if (!looped) i++;
  }
  return order;
}

export type StructureProblem =
  | "invalid_repeat_count"
  | "invalid_ending"
  | "ending_outside_repeat"
  | "missing_segno"
  | "missing_coda"
  | "missing_fine";

export interface StructureError {
  /** 1-based line in the source. */
  readonly line: number;
  /** What was written, such as "{x_ds_al_coda}" or ":|x0". */
  readonly text: string;
  readonly problem: StructureProblem;
}

const DIRECTIVE_LINE = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;

/**
 * Lists repeats, endings and jumps that cannot be followed, so the upload
 * can block them like unknown chords.
 */
export function validateStructure(source: string): StructureError[] {
  const errors: StructureError[] = [];
  const lines = source.split("\n");
  const has = (directive: string) =>
    lines.some((text) => DIRECTIVE_LINE.exec(text)?.[1]?.toLowerCase() === directive);
  let repeatsSoFar = 0;

  lines.forEach((text, index) => {
    const at = (written: string, problem: StructureProblem) => errors.push({ line: index + 1, text: written, problem });
    const directive = DIRECTIVE_LINE.exec(text);
    if (!directive) {
      const times = repeatEndTimes(text);
      if (times !== null) {
        repeatsSoFar++;
        if (times < 2 || times > MAX_TIMES) at(REPEAT_END.exec(text)?.[0] ?? ":|", "invalid_repeat_count");
      }
      return;
    }
    const name = directive[1]?.toLowerCase() ?? "";
    const written = text.trim();
    if (name === "start_of_verse" || name === "start_of_chorus" || name === "start_of_bridge") {
      if (sectionTimes(directive[2] ?? null) > MAX_TIMES) at(written, "invalid_repeat_count");
    }
    if (name === "x_ending") {
      if (!parseEndingNumbers(directive[2] ?? "")) at(written, "invalid_ending");
      // An ending belongs to a repeat that closes after it (1st) or before it (2nd).
      else if (repeatsSoFar === 0 && !lines.slice(index).some((later) => repeatEndTimes(later) !== null)) {
        at(written, "ending_outside_repeat");
      }
    }
    if (name.startsWith("x_ds_") && !has("x_segno")) at(written, "missing_segno");
    if ((name.endsWith("_al_coda") || name === "x_to_coda") && !has("x_coda")) at(written, "missing_coda");
    if (name.endsWith("_al_fine") && !has("x_fine")) at(written, "missing_fine");
  });
  return errors;
}
