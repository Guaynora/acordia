import { isNonChordMarker, parseChord } from "./chord";
import { type Key, parseKey, scaleOf } from "./key";
import { type Note, mod } from "./note";
import type { SongLine } from "./song";

/**
 * Chords as scale degrees (the Nashville number system): 1, 4, 5, 6m in a
 * major key, so a band can play in any key without rewriting the chart.
 * Minor keys count from their own tonic over the natural minor scale (in
 * A minor, Am is 1m and G is 7). Notes outside the scale carry their
 * accidental: Bb in C is b7, F# in C is #4.
 */
export interface ChordDegree {
  /** The root's degree with its accidental, e.g. "6", "b7", "#4". */
  readonly degree: string;
  /** The suffix exactly as written ("m7", "sus4"), usually shown raised. */
  readonly suffix: string;
  /** The bass note's degree, for slash chords; null otherwise. */
  readonly bass: string | null;
}

/** Degree of a note in a key: its position in the scale and how far it is from the scale's note. */
export function noteDegree(note: Note, key: Key): string {
  const steps = mod(note.letter - key.tonic.letter, 7);
  const diatonic = scaleOf(key)[steps];
  const offset = note.accidental - (diatonic?.accidental ?? 0);
  const accidental = offset < 0 ? "b".repeat(-offset) : "#".repeat(offset);
  return `${accidental}${steps + 1}`;
}

/** The chord as degrees of `key`, or null when it does not parse. Markers like N.C. stay as written. */
export function chordDegree(symbol: string, key: Key): ChordDegree | null {
  if (isNonChordMarker(symbol)) return { degree: symbol.trim(), suffix: "", bass: null };
  const chord = parseChord(symbol);
  if (!chord) return null;
  return {
    degree: noteDegree(chord.root, key),
    suffix: chord.suffix,
    bass: chord.bass ? noteDegree(chord.bass, key) : null,
  };
}

/** "6m7", "5/7": a degree written on one line, for text and tests. */
export function formatDegree(degree: ChordDegree): string {
  return degree.degree + degree.suffix + (degree.bass ? `/${degree.bass}` : "");
}

/**
 * The key in force at each line: `start`, then each {key} written after the
 * music has started (before it, {key} restates the song's own key, as in
 * transposeChordPro).
 */
export function keysByLine(lines: readonly SongLine[], start: Key): Key[] {
  let current = start;
  let musicStarted = false;
  return lines.map((line) => {
    if (line.kind === "lyrics") musicStarted = true;
    if (line.kind === "change" && line.directive === "key" && musicStarted) {
      current = parseKey(line.value) ?? current;
    }
    return current;
  });
}
