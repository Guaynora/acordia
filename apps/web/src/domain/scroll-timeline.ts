import type { SongLine } from "@acordia/chord-engine";

/**
 * When the sheet plays, which line and chord sound at each moment.
 *
 * Sheets rarely say how long each chord lasts, so the timeline follows the
 * common "one chord per bar" convention. A lyric line without chords (a
 * repeated verse written only once with chords) is given two bars, about
 * what a sung line takes. Lyrics before a line's first chord are a pickup
 * and take no time of their own.
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

export function buildScrollTimeline(lines: readonly SongLine[]): ScrollTimeline {
  const steps: ScrollStep[] = [];
  let bar = 0;
  const push = (line: number, segment: number | null, bars: number) => {
    steps.push({ line, segment, startBar: bar, bars });
    bar += bars;
  };

  lines.forEach((line, index) => {
    if (line.kind !== "lyrics") return;
    let chords = 0;
    line.segments.forEach((segment, i) => {
      if (segment.chord !== null && segment.chord.trim() !== "") {
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
  if (steps.length === 0 || bar >= timeline.totalBars) return null;
  // Binary search for the last step that starts at or before `bar`.
  let low = 0;
  let high = steps.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if ((steps[mid]?.startBar ?? 0) <= bar) low = mid;
    else high = mid - 1;
  }
  return low;
}
