import { type Interval, applyInterval, intervalBetween } from "./interval";
import { type Key, accidentalStyle, formatKey, keyForPitch, keySignature, parseKey } from "./key";
import { pitchClass } from "./note";
import { suggestChord } from "./suggest";
import { transposeSymbol } from "./transpose";

export interface ChordError {
  readonly line: number;
  readonly column: number;
  readonly symbol: string;
  readonly message: string;
  /** Standard spelling to offer the author, e.g. "Bm" for "Hm". */
  readonly suggestion: string | null;
}

export function chordError(line: number, column: number, symbol: string): ChordError {
  return { line, column, symbol, message: `Unrecognized chord: "${symbol}"`, suggestion: suggestChord(symbol) };
}

export interface TransposeResult {
  readonly text: string;
  readonly errors: readonly ChordError[];
}

const CHORD_IN_BRACKETS = /\[([^\]]*)\]/g;
const KEY_DIRECTIVE = /^\s*\{\s*key\s*:\s*([^}]*)\}\s*$/i;
const DIRECTIVE = /^\s*\{.*\}\s*$/;

/** Reads the {key: ...} directive of a ChordPro song. */
export function readKey(source: string): Key | null {
  for (const line of source.split("\n")) {
    const match = KEY_DIRECTIVE.exec(line);
    if (match) return parseKey(match[1] ?? "");
  }
  return null;
}

/** Lists every bracketed chord that the parser does not recognize. */
export function validateChordPro(source: string, key: Key): ChordError[] {
  return transposeChordPro(source, key, key).errors.slice();
}

/**
 * Where a key a section modulates to lands: moved by the same interval as
 * the song (G -> F moves an Ab chorus to Gb, not F#), respelled only when
 * that gives a key nobody writes (Fb, E#, double accidentals).
 */
export function transposeSectionKey(written: Key, interval: Interval, songTarget: Key): Key {
  const tonic = applyInterval(written.tonic, interval);
  const moved: Key = { tonic, mode: written.mode };
  if (Math.abs(tonic.accidental) <= 1 && Math.abs(keySignature(moved)) <= 7) return moved;
  return keyForPitch(pitchClass(tonic), written.mode, accidentalStyle(songTarget));
}

/**
 * Transposes every [chord] in a ChordPro song and rewrites its {key}
 * directives. A {key} after the music has started is a modulation: that
 * part moves by the same interval but is spelled in its own new key.
 * Bracketed annotations that start with "*" are left as they are.
 */
export function transposeChordPro(source: string, from: Key, to: Key): TransposeResult {
  const errors: ChordError[] = [];
  const interval = intervalBetween(from.tonic, to.tonic);
  // The key the current part is written in, and where it goes.
  let current = { from, to };
  let musicStarted = false;
  const lines = source.split("\n").map((line, index) => {
    const keyMatch = KEY_DIRECTIVE.exec(line);
    if (keyMatch) {
      const written = parseKey(keyMatch[1] ?? "");
      // Before any music, {key} restates the song's key. An unreadable key
      // is left as written (validation reports it) and changes nothing.
      if (!musicStarted) return line.replace(/(:\s*)[^}]*?(\s*\})/, `$1${formatKey(to)}$2`);
      if (!written) return line;
      const target = transposeSectionKey(written, interval, to);
      current = { from: written, to: target };
      return line.replace(/(:\s*)[^}]*?(\s*\})/, `$1${formatKey(target)}$2`);
    }
    if (DIRECTIVE.test(line)) return line;
    if (line.trim() !== "" && !line.trimStart().startsWith("#")) musicStarted = true;
    return line.replace(CHORD_IN_BRACKETS, (whole, symbol: string, offset: number) => {
      if (symbol.startsWith("*") || symbol.trim() === "") return whole;
      const result = transposeSymbol(symbol, current.from, current.to);
      if (!result.ok) {
        errors.push(chordError(index + 1, offset + 1, symbol));
      }
      return `[${result.text}]`;
    });
  });
  return { text: lines.join("\n"), errors };
}
