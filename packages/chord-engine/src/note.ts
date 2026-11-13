/**
 * Spelled notes: a letter plus an accidental.
 *
 * Unlike a pitch class (0-11), a spelled note keeps its letter, so A# and Bb
 * are different notes that share one pitch. Correct transposition depends on
 * moving letters and pitches together.
 */

export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
export type Letter = (typeof LETTERS)[number];

/** Pitch class of each natural note, indexed like LETTERS. */
const NATURAL_PITCH = [0, 2, 4, 5, 7, 9, 11] as const;

export interface Note {
  /** Index into LETTERS: C=0 ... B=6. */
  readonly letter: number;
  /** Semitone offset from the natural: -2 (bb), -1 (b), 0, 1 (#), 2 (##). */
  readonly accidental: number;
}

export type AccidentalStyle = "sharp" | "flat";

export const mod = (n: number, m: number): number => ((n % m) + m) % m;

export function naturalPitch(letter: number): number {
  return NATURAL_PITCH.at(mod(letter, 7)) ?? 0;
}

export function pitchClass(note: Note): number {
  return mod(naturalPitch(note.letter) + note.accidental, 12);
}

/** Smallest signed distance from `from` to `to` on the 12-tone circle (-6..5). */
export function signedSemitones(from: number, to: number): number {
  const d = mod(to - from, 12);
  return d > 5 ? d - 12 : d;
}

/** Builds the note with the given letter that sounds at `pitch`. */
export function spell(letter: number, pitch: number): Note {
  return { letter: mod(letter, 7), accidental: signedSemitones(naturalPitch(letter), pitch) };
}

const NOTE_PATTERN = /^([A-G])(##|bb|#|b|x)?$/;

export function parseNote(text: string): Note | null {
  const match = NOTE_PATTERN.exec(text);
  if (!match) return null;
  const letter = LETTERS.indexOf(match[1] as Letter);
  const accidental = accidentalValue(match[2] ?? "");
  return { letter, accidental };
}

export function accidentalValue(symbol: string): number {
  switch (symbol) {
    case "#":
      return 1;
    case "##":
    case "x":
      return 2;
    case "b":
      return -1;
    case "bb":
      return -2;
    default:
      return 0;
  }
}

export function formatNote(note: Note): string {
  const letter = LETTERS.at(mod(note.letter, 7)) ?? "C";
  const a = note.accidental;
  return letter + (a > 0 ? "#".repeat(a) : "b".repeat(-a));
}

export function noteEquals(a: Note, b: Note): boolean {
  return mod(a.letter, 7) === mod(b.letter, 7) && a.accidental === b.accidental;
}

/**
 * Enharmonic spellings that read as awkward on a chord chart: double
 * accidentals and the white-key accidentals E#, B#, Fb, Cb.
 */
export function isAwkward(note: Note): boolean {
  if (Math.abs(note.accidental) >= 2) return true;
  const name = formatNote(note);
  return name === "E#" || name === "B#" || name === "Fb" || name === "Cb";
}

/** The plainest spelling of a pitch, using sharps or flats for black keys. */
export function simplestSpelling(pitch: number, style: AccidentalStyle): Note {
  const pc = mod(pitch, 12);
  const natural = naturalLetterAt(pc);
  if (natural !== null) return { letter: natural, accidental: 0 };
  // Black keys sit between two naturals: C# is C raised, Db is D lowered.
  const neighbour = style === "sharp" ? naturalLetterAt(pc - 1) : naturalLetterAt(pc + 1);
  return spell(neighbour ?? 0, pc);
}

function naturalLetterAt(pitch: number): number | null {
  const pc = mod(pitch, 12);
  const index = NATURAL_PITCH.findIndex((p) => p === pc);
  return index >= 0 ? index : null;
}
