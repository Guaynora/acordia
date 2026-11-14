/**
 * Time signatures the metronome understands, and how each one is counted.
 *
 * In compound meters (6/8, 12/8) musicians feel the dotted quarter as the
 * beat, so BPM counts dotted quarters and each beat is three eighth clicks.
 * In odd meters (5/8, 7/8) the eighth note is the pulse and accents mark the
 * groups (7/8 = 2+2+3).
 */

/** 0 = downbeat, 1 = secondary accent, 2 = weak click. */
export type Accent = 0 | 1 | 2;

export type MeterKind = "simple" | "compound" | "odd";

export interface Meter {
  readonly signature: string;
  readonly kind: MeterKind;
  /** Accent of each click in one bar. */
  readonly accents: readonly Accent[];
  /** Clicks per counted beat (3 in compound meters). */
  readonly clicksPerBeat: number;
  /** Accent grouping the author asked for (2+2+3), when not the default. */
  readonly groups?: readonly number[];
}

export const METERS: readonly Meter[] = [
  { signature: "2/4", kind: "simple", accents: [0, 2], clicksPerBeat: 1 },
  { signature: "3/4", kind: "simple", accents: [0, 2, 2], clicksPerBeat: 1 },
  { signature: "4/4", kind: "simple", accents: [0, 2, 1, 2], clicksPerBeat: 1 },
  { signature: "5/4", kind: "simple", accents: [0, 2, 2, 1, 2], clicksPerBeat: 1 },
  { signature: "6/8", kind: "compound", accents: [0, 2, 2, 1, 2, 2], clicksPerBeat: 3 },
  { signature: "12/8", kind: "compound", accents: [0, 2, 2, 1, 2, 2, 1, 2, 2, 1, 2, 2], clicksPerBeat: 3 },
  { signature: "5/8", kind: "odd", accents: [0, 2, 1, 2, 2], clicksPerBeat: 1 },
  { signature: "7/8", kind: "odd", accents: [0, 2, 1, 2, 1, 2, 2], clicksPerBeat: 1 },
];

export const TIME_SIGNATURES = METERS.map((m) => m.signature);

/** "7/8", or "7/8 (3+2+2)" when regrouped. */
export function meterName(meter: Meter): string {
  return meter.groups ? `${meter.signature} (${meter.groups.join("+")})` : meter.signature;
}

/** Accents of one bar from its groups: downbeat, then a secondary accent on each group. */
function accentsFromGroups(groups: readonly number[]): Accent[] {
  return groups.flatMap((size, g) => Array.from({ length: size }, (_, i): Accent => (i > 0 ? 2 : g === 0 ? 0 : 1)));
}

/**
 * A meter a song may switch to that the picker does not list, such as 9/8
 * or 3/8: N/8 with N a multiple of 3 (from 6) is compound; other N/8 count
 * eighths in groups of two ending in a three; N/4 and N/2 count each beat.
 */
function meterFromSignature(signature: string): Meter | null {
  const match = /^(\d{1,2})\/(2|4|8)$/.exec(signature);
  const beats = Number(match?.[1]);
  const unit = Number(match?.[2]);
  if (!match || beats < 1) return null;
  if (unit === 8 && beats >= 6 && beats % 3 === 0) {
    return { signature, kind: "compound", accents: accentsFromGroups(Array(beats / 3).fill(3)), clicksPerBeat: 3 };
  }
  if (unit === 8 && beats >= 5) {
    const groups = [...Array(Math.floor(beats / 2) - (beats % 2)).fill(2), ...(beats % 2 ? [3] : [])];
    return { signature, kind: "odd", accents: accentsFromGroups(groups), clicksPerBeat: 1 };
  }
  return { signature, kind: "simple", accents: [0, ...Array(beats - 1).fill(2)], clicksPerBeat: 1 };
}

/**
 * The meter for a signature, optionally regrouped (7/8 as 3+2+2). Unknown
 * signatures fall back to 4/4; groups that do not fill the bar are ignored.
 */
export function meterFor(signature: string, groups?: readonly number[] | null): Meter {
  const base = METERS.find((m) => m.signature === signature) ?? meterFromSignature(signature) ?? (METERS[2] as Meter);
  if (!groups || groups.reduce((a, b) => a + b, 0) !== base.accents.length) return base;
  return { ...base, accents: accentsFromGroups(groups), groups };
}

/** Seconds between two clicks at the given tempo. */
export function secondsPerClick(meter: Meter, bpm: number): number {
  return 60 / (bpm * meter.clicksPerBeat);
}

/**
 * Extra clicks between beats: 2 = eighths, 3 = triplets, 4 = sixteenths
 * (in compound meters, whose clicks are already eighths, 2 = sixteenths).
 */
export type Subdivision = 1 | 2 | 3 | 4;

export function subdivisionsFor(meter: Meter): readonly Subdivision[] {
  return meter.kind === "compound" ? [1, 2] : [1, 2, 3, 4];
}

/** One tick of the metronome: a main click, or a softer one between clicks. */
export interface Step {
  /** Index of the main click in the bar this tick belongs to. */
  readonly click: number;
  /** 0 on the main click, 1.. for the ticks after it. */
  readonly sub: number;
  /** Loudness: the main click's accent, or "sub" for in-between ticks. */
  readonly accent: Accent | "sub";
}

/** Every tick of one bar, in order. */
export function barSteps(meter: Meter, subdivision: Subdivision): Step[] {
  return meter.accents.flatMap((accent, click) =>
    Array.from({ length: subdivision }, (_, sub): Step => ({ click, sub, accent: sub === 0 ? accent : "sub" })),
  );
}

/** Seconds between two ticks. */
export function secondsPerStep(meter: Meter, bpm: number, subdivision: Subdivision): number {
  return secondsPerClick(meter, bpm) / subdivision;
}

/** Main clicks a count-in of `bars` bars plays before the music starts. */
export function countInClicks(meter: Meter, bars: number): number {
  return Math.max(0, Math.floor(bars)) * meter.accents.length;
}
