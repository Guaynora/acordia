import { type Chord, tokenizeSuffix } from "./chord";
import { applyInterval } from "./interval";
import { type Note, pitchClass } from "./note";

/**
 * The notes of a chord, spelled from its root: Cmaj7 is C E G B, F7 is
 * F A C Eb (never D#), Cdim7 is C Eb Gb Bbb. Instrument views draw these.
 */

export interface ChordTone {
  readonly note: Note;
  /** Degree from the root as musicians name it: "1", "b3", "5", "b7", "#11"... */
  readonly degree: string;
  /** Semitones above the root, 0-11. */
  readonly semitones: number;
}

export interface ChordTones {
  readonly root: Note;
  /** The lowest note: the slash bass, or the root. */
  readonly bass: Note;
  /** Ordered by degree (1, 3, 5, 7, 9, 11, 13). */
  readonly tones: readonly ChordTone[];
}

/** Letter steps and semitones above the root for each degree. */
const DEGREES = {
  "1": [0, 0],
  b2: [1, 1],
  "2": [1, 2],
  b3: [2, 3],
  "3": [2, 4],
  "4": [3, 5],
  b5: [4, 6],
  "5": [4, 7],
  "#5": [4, 8],
  "6": [5, 9],
  bb7: [6, 9],
  b7: [6, 10],
  "7": [6, 11],
  b9: [1, 1],
  "9": [1, 2],
  "#9": [1, 3],
  "11": [3, 5],
  "#11": [3, 6],
  b13: [5, 8],
  "13": [5, 9],
} as const satisfies Record<string, readonly [number, number]>;

type Degree = keyof typeof DEGREES;

/** Order in which degrees are listed: by chord-tone number, then alteration. */
const ORDER: readonly Degree[] = [
  "1", "b2", "2", "b3", "3", "4", "b5", "5", "#5", "6", "bb7", "b7", "7",
  "b9", "9", "#9", "11", "#11", "b13", "13",
];

export function chordTones(chord: Chord): ChordTones | null {
  const tokens = tokenizeSuffix(chord.suffix);
  if (!tokens) return null;
  const degrees = degreesOf(tokens);
  const tones = ORDER.filter((d) => degrees.has(d)).map((degree) => {
    const [steps, semitones] = DEGREES[degree];
    return { degree, semitones, note: applyInterval(chord.root, { steps, semitones }) };
  });
  return { root: chord.root, bass: chord.bass ?? chord.root, tones };
}

function degreesOf(tokens: readonly string[]): Set<Degree> {
  const has = (...names: string[]) => tokens.some((t) => names.includes(t));
  const set = new Set<Degree>(["1", "3", "5"]);
  const replace = (from: Degree, to: Degree | null) => {
    set.delete(from);
    if (to) set.add(to);
  };

  // Power chord: root and fifth only.
  if (tokens.length === 1 && tokens[0] === "5") return new Set(["1", "5"]);

  // Third
  const minor = has("min", "mi", "m", "-") || has("dim", "dim7", "°", "°7", "o7", "ø", "ø7");
  if (minor) replace("3", "b3");
  if (has("sus2") || (has("2") && !has("add2"))) replace("3", "2");
  else if (has("sus", "sus4") || (has("4") && !has("add4"))) replace("3", "4");

  // Fifth
  if (has("dim", "dim7", "°", "°7", "o7", "ø", "ø7", "b5", "-5")) replace("5", "b5");
  if (has("aug", "+", "#5", "+5")) replace("5", "#5");

  // Seventh
  const majorSeventh = has("maj13", "maj11", "maj9", "maj7", "Maj13", "Maj11", "Maj9", "Maj7", "ma13", "ma11", "ma9", "ma7", "M13", "M11", "M9", "M7", "Δ7", "Δ9", "Δ");
  const extended = has("7", "9", "11", "13", "maj9", "maj11", "maj13", "Maj9", "Maj11", "Maj13", "ma9", "ma11", "ma13", "M9", "M11", "M13", "Δ9");
  if (has("dim7", "°7", "o7")) set.add("bb7");
  else if (majorSeventh) set.add("7");
  else if (extended || has("ø", "ø7", "alt")) set.add("b7");

  // Sixths
  if (has("6", "6/9", "69", "b6")) set.add(has("b6") ? "b13" : "6");

  // Extensions: a 13 implies the 9; an 11 implies the 9 too.
  const ninth = has("9", "maj9", "Maj9", "ma9", "M9", "Δ9", "6/9", "69", "add9");
  const eleventh = has("11", "maj11", "Maj11", "ma11", "M11", "add11");
  const thirteenth = has("13", "maj13", "Maj13", "ma13", "M13", "add13");
  if (ninth || eleventh || (thirteenth && !has("add13"))) set.add("9");
  if (eleventh) set.add("11");
  if (thirteenth) set.add("13");
  if (has("add2")) set.add("2");
  if (has("add4")) set.add("4");
  // A dominant 11 drops the third, which clashes with the 11th.
  if (eleventh && !minor && !has("add11") && set.has("3")) replace("3", null);

  // Alterations replace the plain extension they bend.
  if (has("b9")) replace("9", "b9");
  if (has("#9", "+9")) replace("9", "#9");
  if (has("#11", "+11")) set.add("#11");
  if (has("b13")) replace("13", "b13");
  if (has("alt")) {
    replace("5", null);
    replace("9", null);
    set.add("b9").add("#9").add("b13");
  }
  return set;
}

// --- Instrument helpers -------------------------------------------------------

/** MIDI number of middle C (C4). */
export const MIDDLE_C = 60;

export interface PianoVoicing {
  /** Left hand: the bass note, MIDI. */
  readonly left: number;
  /** Right hand: chord tones in close position, ascending, MIDI. */
  readonly right: readonly number[];
}

/**
 * A comfortable two-hand voicing: the bass in the octave below middle C (or
 * the one below that, to stay clear of the right hand) and
 * the chord tones close together around E4, the inversion whose centre sits
 * nearest that spot. Extensions beyond the seventh are kept, so dense chords
 * may span more than an octave.
 */
export function pianoVoicing(chord: ChordTones): PianoVoicing {
  const left = MIDDLE_C - 12 + pitchClass(chord.bass);
  const classes = chord.tones.map((t) => pitchClass(t.note));
  const target = MIDDLE_C + 4;
  let best: number[] = [];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let start = 0; start < classes.length; start++) {
    const order = [...classes.slice(start), ...classes.slice(0, start)];
    for (const base of [MIDDLE_C - 12, MIDDLE_C]) {
      const notes: number[] = [];
      for (const pc of order) {
        let midi = base + pc;
        while (notes.length > 0 && midi <= (notes.at(-1) ?? 0)) midi += 12;
        notes.push(midi);
      }
      if ((notes[0] ?? 0) < MIDDLE_C - 3) continue;
      const centre = notes.reduce((sum, n) => sum + n, 0) / notes.length;
      const distance = Math.abs(centre - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = notes;
      }
    }
  }
  // Keep the hands apart: the bass goes an octave down if it would touch or
  // cross the lowest right-hand note.
  const lowest = best[0] ?? MIDDLE_C;
  return { left: left > lowest - 3 ? left - 12 : left, right: best };
}

/** Standard four-string bass, low to high, as MIDI (E1 A1 D2 G2). */
export const BASS_TUNING = [28, 33, 38, 43] as const;

export interface FretPosition {
  /** Index into the tuning, 0 = lowest string. */
  readonly string: number;
  readonly fret: number;
}

/** Every place a note can be played on a fretted instrument, up to `maxFret`. */
export function fretPositions(note: Note, tuning: readonly number[], maxFret = 12): FretPosition[] {
  const pc = pitchClass(note);
  const positions: FretPosition[] = [];
  tuning.forEach((open, string) => {
    for (let fret = 0; fret <= maxFret; fret++) {
      if ((open + fret) % 12 === pc) positions.push({ string, fret });
    }
  });
  return positions;
}
