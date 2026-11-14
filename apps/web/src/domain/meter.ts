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

export function meterFor(signature: string): Meter {
  return METERS.find((m) => m.signature === signature) ?? (METERS[2] as Meter);
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
