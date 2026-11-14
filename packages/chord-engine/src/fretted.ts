import { pitchClass } from "./note";
import type { ChordTones } from "./tones";

/**
 * Chord shapes for fretted instruments (guitar, ukulele). A shape lists one
 * fret per string, low to high as the instrument is tuned; -1 is a muted
 * string and 0 an open one. Frets are absolute (5 means the fifth fret).
 */
export interface FretShape {
  readonly frets: readonly number[];
  /** 1-4 per string (0 = open or muted), when known. */
  readonly fingers?: readonly number[] | undefined;
  /** Absolute frets held down by one finger across several strings. */
  readonly barres?: readonly number[] | undefined;
}

/** Open strings as MIDI, low to high. */
export const GUITAR_TUNING = [40, 45, 50, 55, 59, 64] as const; // E2 A2 D3 G3 B3 E4
/** Re-entrant: the G string is higher than the C. */
export const UKULELE_TUNING = [67, 60, 64, 69] as const; // G4 C4 E4 A4

export function shapeMidi(shape: FretShape, tuning: readonly number[]): number[] {
  return shape.frets.flatMap((fret, string) => (fret < 0 ? [] : [(tuning[string] ?? 0) + fret]));
}

/** Degrees a player may leave out without changing what the chord is. */
const OPTIONAL = new Set(["5", "9", "11"]);

/**
 * Whether a shape plays this chord: every note belongs to the chord, every
 * essential tone is there (the plain fifth, and the 9 or 11 under a 13, may
 * be left out) and, when `checkBass`, the lowest note is the chord's bass.
 */
export function shapeMatches(
  shape: FretShape,
  chord: ChordTones,
  tuning: readonly number[],
  checkBass: boolean,
): boolean {
  const midi = shapeMidi(shape, tuning);
  if (midi.length < 3) return false;
  const played = new Set(midi.map((m) => m % 12));
  const allowed = new Set(chord.tones.map((t) => pitchClass(t.note)));
  allowed.add(pitchClass(chord.bass));
  for (const pc of played) if (!allowed.has(pc)) return false;

  const hasThirteenth = chord.tones.some((t) => t.degree === "13" || t.degree === "b13");
  for (const tone of chord.tones) {
    const optional = tone.degree === "5" || (hasThirteenth && OPTIONAL.has(tone.degree));
    if (!optional && !played.has(pitchClass(tone.note))) return false;
  }
  if (!checkBass) return true;
  return Math.min(...midi) % 12 === pitchClass(chord.bass);
}

export interface GenerateOptions {
  /** Require the chord's bass as the lowest note (off for re-entrant tunings). */
  readonly checkBass: boolean;
  /** Highest fret a shape may reach. */
  readonly maxFret?: number;
  /** Frets one hand covers. */
  readonly span?: number;
  readonly limit?: number;
}

/**
 * Searches playable shapes for chords no fingering library covers: within a
 * four-fret window, only muting strings from the low side, sounding at least
 * all but two strings. Lower, fuller, simpler shapes come first.
 */
export function generateShapes(chord: ChordTones, tuning: readonly number[], options: GenerateOptions): FretShape[] {
  const { checkBass, maxFret = 12, span = 4, limit = 3 } = options;
  const allowed = new Set(chord.tones.map((t) => pitchClass(t.note)));
  allowed.add(pitchClass(chord.bass));
  const minStrings = Math.max(3, tuning.length - 2);
  const found = new Map<string, { shape: FretShape; score: number }>();

  for (let base = 1; base + span - 1 <= maxFret; base++) {
    const choices = tuning.map((open) => {
      const options = [-1];
      for (const fret of [0, ...Array.from({ length: span }, (_, i) => base + i)]) {
        if (allowed.has((open + fret) % 12)) options.push(fret);
      }
      return options;
    });

    const walk = (string: number, frets: number[]) => {
      if (string === tuning.length) {
        const shape = { frets: [...frets] };
        const sounding = frets.filter((f) => f >= 0).length;
        if (sounding < minStrings || !shapeMatches(shape, chord, tuning, checkBass)) return;
        const key = frets.join(",");
        if (found.has(key)) return;
        const fretted = frets.filter((f) => f > 0);
        const lowest = fretted.length > 0 ? Math.min(...fretted) : 0;
        // One finger can bar the lowest fret; every other fretted note needs its own.
        const fingers = fretted.filter((f) => f !== lowest).length + (fretted.length > 0 ? 1 : 0);
        if (fingers > 4) return;
        const score = lowest * 3 + fingers * 2 - sounding * 2;
        found.set(key, { shape, score });
        return;
      }
      for (const fret of choices[string] ?? []) {
        // Mute only from the low side: no muted string after a sounding one.
        if (fret === -1 && frets.some((f) => f >= 0)) continue;
        frets.push(fret);
        walk(string + 1, frets);
        frets.pop();
      }
    };
    walk(0, []);
  }

  return [...found.values()]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.shape);
}
