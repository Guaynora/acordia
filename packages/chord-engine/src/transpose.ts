import { type Chord, parseChord, formatChord, isNonChordMarker } from "./chord.js";
import { type Interval, applyInterval, intervalBetween } from "./interval.js";
import { type Key, accidentalStyle, isDiatonic } from "./key.js";
import { type Note, isAwkward, pitchClass, simplestSpelling } from "./note.js";

/**
 * Moves a note by an interval and cleans up spellings no chart should show
 * (E#, Cb, double sharps), unless the target key genuinely uses them, as
 * Cb does in Gb major.
 */
export function transposeNote(note: Note, interval: Interval, targetKey: Key): Note {
  const moved = applyInterval(note, interval);
  if (!isAwkward(moved) || isDiatonic(moved, targetKey)) return moved;
  return simplestSpelling(pitchClass(moved), accidentalStyle(targetKey));
}

export function transposeChord(chord: Chord, from: Key, to: Key): Chord {
  const interval = intervalBetween(from.tonic, to.tonic);
  return {
    ...chord,
    root: transposeNote(chord.root, interval, to),
    bass: chord.bass ? transposeNote(chord.bass, interval, to) : null,
  };
}

export type SymbolResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly text: string; readonly error: string };

/**
 * Transposes one chord symbol as written. Unknown symbols are reported as
 * errors instead of being passed through silently: a chart where most chords
 * move and a few stay behind is exactly the bug this engine exists to fix.
 */
export function transposeSymbol(symbol: string, from: Key, to: Key): SymbolResult {
  if (isNonChordMarker(symbol)) return { ok: true, text: symbol };
  const chord = parseChord(symbol);
  if (!chord) return { ok: false, text: symbol, error: `Unrecognized chord: "${symbol}"` };
  return { ok: true, text: formatChord(transposeChord(chord, from, to)) };
}
