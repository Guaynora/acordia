import { isNonChordMarker, parseChord } from "./chord";
import { type ChordError, chordError } from "./chordpro";
import { sectionKindFromLabel } from "./song";
import { suggestChord } from "./suggest";

export interface ImportResult {
  readonly chordpro: string;
  readonly errors: readonly ChordError[];
}

interface Token {
  readonly text: string;
  readonly column: number;
}

/** Repeat marks and similar notes that may sit on a chord line. */
const LINE_DECORATION = /^\(?x\d+\)?$/i;
const SECTION_IN_BRACKETS = /^\s*\[([^\]]+)\]\s*$/;
const SECTION_WITH_COLON = /^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 .]{0,30}):\s*$/;

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  for (const match of line.matchAll(/\S+/g)) {
    tokens.push({ text: match[0], column: match.index ?? 0 });
  }
  return tokens;
}

type LineKind =
  | { readonly kind: "chords"; readonly tokens: Token[]; readonly unknown: Token[] }
  | { readonly kind: "text" };

/**
 * A line is a chord line when at least half of its tokens are chords, or
 * when every token is a chord in another notation (Latin "Lam", German "H").
 * Tokens that are not standard chords are reported so the author fixes them
 * before publishing.
 */
function classify(line: string): LineKind {
  const tokens = tokenize(line).filter((t) => !LINE_DECORATION.test(t.text));
  if (tokens.length === 0) return { kind: "text" };
  const chords = tokens.filter((t) => isNonChordMarker(t.text) || parseChord(t.text));
  const realChords = chords.filter((t) => !isNonChordMarker(t.text));
  const allChordLike = tokens.every((t) => chords.includes(t) || suggestChord(t.text));
  const mostlyChords = realChords.length > 0 && chords.length * 2 >= tokens.length;
  if (!mostlyChords && !allChordLike) return { kind: "text" };
  const unknown = tokens.filter((t) => !chords.includes(t));
  return { kind: "chords", tokens, unknown };
}

function sectionName(line: string): string | null {
  const bracketed = SECTION_IN_BRACKETS.exec(line);
  if (bracketed && !parseChord(bracketed[1] ?? "")) return (bracketed[1] ?? "").trim();
  const colon = SECTION_WITH_COLON.exec(line);
  if (colon && !parseChord(colon[1] ?? "")) return (colon[1] ?? "").trim();
  return null;
}

/** Places each chord into the lyric line at the column where it stood. */
function mergeChordsIntoLyrics(chords: Token[], lyrics: string): string {
  const width = Math.max(lyrics.length, ...chords.map((c) => c.column));
  let merged = lyrics.padEnd(width);
  for (const chord of [...chords].reverse()) {
    merged = `${merged.slice(0, chord.column)}[${chord.text}]${merged.slice(chord.column)}`;
  }
  return merged.trimEnd();
}

/**
 * Converts the common "chords over lyrics" plain-text layout (as found on
 * most chord sites) into ChordPro.
 */
export function importChordsOverLyrics(text: string): ImportResult {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n");
  const output: string[] = [];
  const errors: ChordError[] = [];
  let openSection: string | null = null;

  const closeSection = () => {
    if (!openSection) return;
    // Keep blank lines outside the section so spacing stays the same.
    let trailingBlanks = 0;
    while (output.length > 0 && output.at(-1) === "") {
      output.pop();
      trailingBlanks++;
    }
    output.push(`{end_of_${openSection}}`, ...Array<string>(trailingBlanks).fill(""));
    openSection = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines.at(i) ?? "";
    const section = sectionName(line);
    if (section) {
      // Known sections become real ChordPro blocks; the rest stay labels.
      closeSection();
      const kind = sectionKindFromLabel(section);
      if (kind === "other") {
        output.push(`{comment: ${section}}`);
      } else {
        output.push(`{start_of_${kind}: ${section}}`);
        openSection = kind;
      }
      continue;
    }

    const kind = classify(line);
    if (kind.kind === "text") {
      output.push(line.trimEnd());
      continue;
    }

    for (const token of kind.unknown) {
      errors.push(chordError(i + 1, token.column + 1, token.text));
    }

    const next = lines.at(i + 1);
    const nextIsLyrics =
      next !== undefined && next.trim() !== "" && classify(next).kind === "text" && !sectionName(next);
    if (nextIsLyrics) {
      output.push(mergeChordsIntoLyrics(kind.tokens, next));
      i++;
    } else {
      output.push(kind.tokens.map((t) => `[${t.text}]`).join(" "));
    }
  }
  closeSection();

  return { chordpro: output.join("\n"), errors };
}
