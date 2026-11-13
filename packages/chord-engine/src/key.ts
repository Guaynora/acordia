import {
  type AccidentalStyle,
  type Note,
  formatNote,
  mod,
  naturalPitch,
  parseNote,
  pitchClass,
  signedSemitones,
  spell,
} from "./note";

export type Mode = "major" | "minor";

export interface Key {
  readonly tonic: Note;
  readonly mode: Mode;
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const;
const NATURAL_MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10] as const;

/** Position of each natural letter on the line of fifths (C=0, G=1, F=-1). */
const LETTER_FIFTHS = [0, 2, 4, -1, 1, 3, 5] as const;

const KEY_PATTERN = /^([A-G](?:#|b)?)\s*(m|min|minor|-)?$/;

export function parseKey(text: string): Key | null {
  const match = KEY_PATTERN.exec(text.trim());
  if (!match) return null;
  const tonic = parseNote(match[1] ?? "");
  if (!tonic) return null;
  return { tonic, mode: match[2] ? "minor" : "major" };
}

export function formatKey(key: Key): string {
  return formatNote(key.tonic) + (key.mode === "minor" ? "m" : "");
}

/**
 * Key signature as a signed count: +n sharps or -n flats.
 * Minor keys share the signature of their relative major (A minor = C major).
 */
export function keySignature(key: Key): number {
  const letterFifths = LETTER_FIFTHS.at(mod(key.tonic.letter, 7)) ?? 0;
  const major = letterFifths + 7 * key.tonic.accidental;
  return key.mode === "minor" ? major - 3 : major;
}

export function accidentalStyle(key: Key): AccidentalStyle {
  return keySignature(key) < 0 ? "flat" : "sharp";
}

/** The seven diatonic notes of the key, starting on the tonic. */
export function scaleOf(key: Key): Note[] {
  const steps = key.mode === "minor" ? NATURAL_MINOR_SCALE : MAJOR_SCALE;
  const root = pitchClass(key.tonic);
  return steps.map((semitones, degree) => spell(key.tonic.letter + degree, root + semitones));
}

export function isDiatonic(note: Note, key: Key): boolean {
  return scaleOf(key).some((n) => mod(n.letter, 7) === mod(note.letter, 7) && n.accidental === note.accidental);
}

/**
 * Picks the most readable key for a pitch: the spelling with the fewest
 * accidentals in its signature (Db over C#, Bb over A#). The one real tie,
 * F#/Gb major (D#m/Ebm), follows the caller's preference.
 */
export function keyForPitch(pitch: number, mode: Mode, preference: AccidentalStyle = "sharp"): Key {
  const candidates: Key[] = [];
  for (let letter = 0; letter < 7; letter++) {
    const accidental = signedSemitones(naturalPitch(letter), pitch);
    if (Math.abs(accidental) <= 1) candidates.push({ tonic: { letter, accidental }, mode });
  }
  candidates.sort((a, b) => {
    const diff = Math.abs(keySignature(a)) - Math.abs(keySignature(b));
    if (diff !== 0) return diff;
    const sign = preference === "sharp" ? -1 : 1;
    return sign * (keySignature(a) - keySignature(b));
  });
  const best = candidates[0];
  if (!best) throw new Error(`No key found for pitch ${pitch}`);
  return best;
}

/** Moves a key by semitones and respells it as the most readable key. */
export function transposeKey(key: Key, semitones: number, preference: AccidentalStyle = "sharp"): Key {
  return keyForPitch(pitchClass(key.tonic) + semitones, key.mode, preference);
}

export function semitonesBetween(from: Key, to: Key): number {
  return mod(pitchClass(to.tonic) - pitchClass(from.tonic), 12);
}
