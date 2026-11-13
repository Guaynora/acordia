import { parseChord } from "./chord";

/** Solfège roots as written in Spanish, Italian, French and Portuguese charts. */
const LATIN_ROOTS: Record<string, string> = {
  Do: "C",
  Re: "D",
  Mi: "E",
  Fa: "F",
  Sol: "G",
  La: "A",
  Si: "B",
};

const LATIN_CHORD = /^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?(.*)$/;

/**
 * Proposes the standard spelling of a chord the parser rejected, or null.
 * Only capitalized forms are considered, so lyrics such as "la" or "mi" are
 * never mistaken for chords.
 *
 * - Latin notation: Lam -> Am, Sol7 -> G7, Fa#m -> F#m, Sibmaj7 -> Bbmaj7
 * - German notation: H -> B, Hm7 -> Bm7
 * - Stray trailing punctuation: G7. -> G7
 */
export function suggestChord(symbol: string): string | null {
  if (parseChord(symbol)) return null;
  const candidates = [latinToLetters(symbol), germanToLetters(symbol), symbol.replace(/[.,;:*]+$/, "")];
  for (const candidate of candidates) {
    if (!candidate || candidate === symbol) continue;
    const slash = candidate.lastIndexOf("/");
    // Convert a Latin or German bass note too: "Do/Mi" -> "C/E".
    const fixed =
      slash > 0
        ? `${candidate.slice(0, slash)}/${latinToLetters(candidate.slice(slash + 1)) ?? germanToLetters(candidate.slice(slash + 1)) ?? candidate.slice(slash + 1)}`
        : candidate;
    if (parseChord(fixed)) return fixed;
    if (parseChord(candidate)) return candidate;
  }
  return null;
}

function latinToLetters(symbol: string): string | null {
  const match = LATIN_CHORD.exec(symbol);
  if (!match) return null;
  const root = LATIN_ROOTS[match[1] ?? ""];
  return root ? root + (match[2] ?? "") + (match[3] ?? "") : null;
}

function germanToLetters(symbol: string): string | null {
  return symbol.startsWith("H") ? `B${symbol.slice(1)}` : null;
}
