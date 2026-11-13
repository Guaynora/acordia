import { type Note, formatNote, parseNote } from "./note.js";

export type Quality = "major" | "minor" | "diminished" | "half-diminished" | "augmented" | "suspended" | "power";

/**
 * A parsed chord symbol. The suffix is kept exactly as written ("m7(b5)",
 * "maj7", "sus4add9") so the author's style survives transposition; only the
 * root and the bass note move.
 */
export interface Chord {
  readonly root: Note;
  readonly suffix: string;
  readonly bass: Note | null;
  readonly quality: Quality;
}

/**
 * Every token a chord suffix may contain. Longer tokens come first so that
 * "maj7" wins over "m", and "-5" (flat five) wins over "-" (minor).
 */
const SUFFIX_TOKENS = [
  // Major seventh family
  "maj13", "maj11", "maj9", "maj7", "Maj13", "Maj11", "Maj9", "Maj7", "maj", "Maj",
  "ma13", "ma11", "ma9", "ma7", "M13", "M11", "M9", "M7", "Δ7", "Δ9", "Δ", "M",
  // Altered tones (before quality tokens that share a character)
  "b13", "#11", "b9", "#9", "b5", "#5", "-5", "+5", "b6", "+9", "+11", "alt",
  // Diminished, augmented, suspended
  "dim7", "dim", "°7", "°", "o7", "ø7", "ø", "aug", "+",
  "sus2", "sus4", "sus",
  // Added tones
  "add13", "add11", "add9", "add4", "add2",
  // Minor
  "min", "mi", "m", "-",
  // Extensions and sixths
  "6/9", "69", "13", "11", "9", "7", "6", "5", "4", "2",
  // Grouping
  "(", ")", ",",
];

const TOKEN_PATTERN = new RegExp(
  `^(?:${SUFFIX_TOKENS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
);

const ROOT_PATTERN = /^([A-G](?:##|bb|#|b)?)/;

/** Splits a suffix into known tokens, or returns null if any part is unknown. */
export function tokenizeSuffix(suffix: string): string[] | null {
  const tokens: string[] = [];
  let rest = suffix;
  while (rest.length > 0) {
    const match = TOKEN_PATTERN.exec(rest);
    if (!match || match[0].length === 0) return null;
    tokens.push(match[0]);
    rest = rest.slice(match[0].length);
  }
  return balancedParentheses(tokens) ? tokens : null;
}

function balancedParentheses(tokens: string[]): boolean {
  let depth = 0;
  for (const t of tokens) {
    if (t === "(") depth++;
    if (t === ")") depth--;
    if (depth < 0 || depth > 1) return false;
  }
  return depth === 0;
}

function qualityOf(tokens: string[]): Quality {
  const has = (...names: string[]) => tokens.some((t) => names.includes(t));
  if (has("ø", "ø7")) return "half-diminished";
  if (has("dim", "dim7", "°", "°7", "o7")) return "diminished";
  if (has("aug", "+")) return "augmented";
  if (has("min", "mi", "m", "-")) {
    return has("b5", "-5") && has("7") ? "half-diminished" : "minor";
  }
  if (has("sus", "sus2", "sus4")) return "suspended";
  if (tokens.length === 1 && tokens[0] === "5") return "power";
  return "major";
}

export function parseChord(text: string): Chord | null {
  const symbol = text.trim();
  const rootMatch = ROOT_PATTERN.exec(symbol);
  if (!rootMatch) return null;
  const root = parseNote(rootMatch[1] ?? "");
  if (!root) return null;

  let body = symbol.slice(rootMatch[0].length);
  let bass: Note | null = null;

  // A slash introduces a bass note, except in "6/9" where it is part of the suffix.
  const slash = body.lastIndexOf("/");
  if (slash >= 0) {
    const candidate = parseNote(body.slice(slash + 1));
    if (candidate) {
      bass = candidate;
      body = body.slice(0, slash);
    }
  }

  const tokens = tokenizeSuffix(body);
  if (!tokens) return null;
  return { root, suffix: body, bass, quality: qualityOf(tokens) };
}

export function formatChord(chord: Chord): string {
  return formatNote(chord.root) + chord.suffix + (chord.bass ? `/${formatNote(chord.bass)}` : "");
}

/** Markers that occupy a chord position but are not chords. */
const NON_CHORD_MARKERS = new Set(["N.C.", "NC", "N.C", "%", "|", "||", "-", "/"]);

export function isNonChordMarker(text: string): boolean {
  return NON_CHORD_MARKERS.has(text.trim());
}
