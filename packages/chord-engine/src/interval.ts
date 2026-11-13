import { type Note, mod, pitchClass, spell } from "./note.js";

/**
 * A musical interval: how many letters to move and how many semitones.
 *
 * G to F is "one letter down, two semitones down". Applying that to F# gives
 * E (not F, and not Gb), which is what keeps spelling correct in the new key.
 */
export interface Interval {
  /** Letter steps upward, 0-6. */
  readonly steps: number;
  /** Semitones upward, 0-11. */
  readonly semitones: number;
}

export function intervalBetween(from: Note, to: Note): Interval {
  return {
    steps: mod(to.letter - from.letter, 7),
    semitones: mod(pitchClass(to) - pitchClass(from), 12),
  };
}

export function applyInterval(note: Note, interval: Interval): Note {
  return spell(note.letter + interval.steps, pitchClass(note) + interval.semitones);
}
