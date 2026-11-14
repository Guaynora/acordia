import type { SongLine } from "@acordia/chord-engine";

/**
 * When the sheet plays, which line and chord sound at each moment.
 *
 * A line with bar lines ("|") says how long its chords last: each bar is
 * one bar long, the chords inside a bar share it equally, and a bar without
 * chords holds the chord before it. Anything before the first "|" is a bar
 * when it has chords and a pickup when it does not; after the last "|",
 * only chords make another bar.
 *
 * Lines without bar lines follow the common "one chord per bar" convention.
 * A lyric line without chords (a repeated verse written only once with
 * chords) is given two bars, about what a sung line takes. Lyrics before a
 * line's first chord are a pickup and take no time of their own.
 */

export const BARS_PER_CHORD = 1;
export const BARS_PER_BARE_LINE = 2;

export interface ScrollStep {
  /** Index into the parsed song's `lines`. */
  readonly line: number;
  /** Index into that line's segments, or null for a line without chords. */
  readonly segment: number | null;
  readonly startBar: number;
  readonly bars: number;
}

export interface ScrollTimeline {
  readonly steps: readonly ScrollStep[];
  readonly totalBars: number;
}

type Segments = Extract<SongLine, { kind: "lyrics" }>["segments"];

const hasChord = (chord: string | null): chord is string => chord !== null && chord.trim() !== "";

/** Chord segments of a line grouped by bar lines; null when it has none. */
function barGroups(segments: Segments): number[][] | null {
  const groups: number[][] = [[]];
  segments.forEach((segment, i) => {
    if (hasChord(segment.chord)) groups.at(-1)?.push(i);
    for (const char of segment.text) if (char === "|") groups.push([]);
  });
  return groups.length > 1 ? groups : null;
}

export function buildScrollTimeline(lines: readonly SongLine[]): ScrollTimeline {
  const steps: { line: number; segment: number | null; startBar: number; bars: number }[] = [];
  let bar = 0;
  const push = (line: number, segment: number | null, bars: number) => {
    steps.push({ line, segment, startBar: bar, bars });
    bar += bars;
  };

  lines.forEach((line, index) => {
    if (line.kind !== "lyrics") return;

    const groups = barGroups(line.segments);
    if (groups) {
      const lineStart = steps.length;
      groups.forEach((chords, g) => {
        const edge = g === 0 || g === groups.length - 1;
        // Before the first or after the last bar line, only chords make a bar.
        if (edge && chords.length === 0) return;
        if (chords.length > 0) {
          for (const segment of chords) push(index, segment, 1 / chords.length);
          return;
        }
        // A bar without chords holds the last chord of this line, or the line itself.
        const last = steps.length > lineStart ? steps.at(-1) : undefined;
        if (last) {
          last.bars += 1;
          bar += 1;
        } else {
          push(index, null, 1);
        }
      });
      return;
    }

    let chords = 0;
    line.segments.forEach((segment, i) => {
      if (hasChord(segment.chord)) {
        push(index, i, BARS_PER_CHORD);
        chords++;
      }
    });
    if (chords === 0 && line.segments.some((s) => s.text.trim() !== "")) {
      push(index, null, BARS_PER_BARE_LINE);
    }
  });

  return { steps, totalBars: bar };
}

/**
 * Index of the step sounding at `bar` (bars since the first step started),
 * or null once the song is over. Negative bars clamp to the first step.
 */
export function stepIndexAt(timeline: ScrollTimeline, bar: number): number | null {
  const { steps } = timeline;
  if (steps.length === 0 || bar >= timeline.totalBars - 1e-9) return null;
  // Binary search for the last step that starts at or before `bar`.
  let low = 0;
  let high = steps.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    // Shared bars add up thirds and the like: allow for rounding.
    if ((steps[mid]?.startBar ?? 0) <= bar + 1e-9) low = mid;
    else high = mid - 1;
  }
  return low;
}
