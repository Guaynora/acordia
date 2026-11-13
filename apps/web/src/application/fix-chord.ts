import { looksLikeChordPro } from "./publish-song";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Replaces an unrecognized chord with its suggested spelling.
 *
 * In ChordPro only bracketed chords change. In plain "chords over lyrics"
 * text only the reported chord lines change, never lyrics, and a shorter
 * replacement is padded so the chords after it stay above their syllables.
 */
export function replaceChord(source: string, symbol: string, replacement: string, lines: readonly number[]): string {
  if (looksLikeChordPro(source)) {
    return source.split(`[${symbol}]`).join(`[${replacement}]`);
  }
  const token = new RegExp(`(^|\\s)${escape(symbol)}(?=\\s|$)`, "g");
  const padded = replacement.padEnd(symbol.length);
  const targets = new Set(lines);
  return source
    .split(/\r?\n/)
    .map((line, index) => (targets.has(index + 1) ? line.replace(token, `$1${padded}`).trimEnd() : line))
    .join("\n");
}
