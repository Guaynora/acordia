import { type Key, formatKey, transposeKey } from "./key.js";
import type { AccidentalStyle } from "./note.js";

/** Keys whose chords are mostly open shapes on guitar. */
const OPEN_SHAPE_KEYS = new Set(["C", "G", "D", "A", "E", "Am", "Em", "Dm"]);

/** The key of the shapes a guitarist plays with a capo on `fret`. */
export function shapeKey(soundingKey: Key, fret: number, preference: AccidentalStyle = "sharp"): Key {
  return transposeKey(soundingKey, -fret, preference);
}

export interface CapoOption {
  readonly fret: number;
  readonly shapes: Key;
}

/** Capo positions (0-7) that let the song be played with open shapes. */
export function suggestCapos(soundingKey: Key): CapoOption[] {
  const options: CapoOption[] = [];
  for (let fret = 0; fret <= 7; fret++) {
    const shapes = shapeKey(soundingKey, fret);
    if (OPEN_SHAPE_KEYS.has(formatKey(shapes))) options.push({ fret, shapes });
  }
  return options;
}
