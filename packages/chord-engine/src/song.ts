/**
 * Parses a ChordPro song into a structure that a UI can render directly:
 * metadata from directives, and lines split into chord/lyric segments.
 */

import { CHANGE_DIRECTIVES, type ChangeDirective } from "./tempo-directives";

export interface Segment {
  /** Chord placed above the start of `text`, or null for leading lyrics. */
  readonly chord: string | null;
  readonly text: string;
}

export type SongLine =
  | { readonly kind: "lyrics"; readonly segments: readonly Segment[] }
  | { readonly kind: "comment"; readonly text: string }
  | { readonly kind: "section-start"; readonly section: string; readonly label: string | null }
  | { readonly kind: "section-end"; readonly section: string }
  /** A tempo, meter, key, grouping or ramp directive, raw as written. */
  | { readonly kind: "change"; readonly directive: ChangeDirective; readonly value: string }
  | { readonly kind: "empty" };

export interface ParsedSong {
  readonly metadata: Readonly<Record<string, string>>;
  readonly lines: readonly SongLine[];
}

export type SectionKind = "verse" | "chorus" | "bridge" | "other";

/** Recognizes common section names in Spanish and English. */
export function sectionKindFromLabel(label: string): SectionKind {
  const name = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
  if (/^(coro|estribillo|refran|chorus|refrain)\b/.test(name)) return "chorus";
  if (/^(verso|estrofa|verse|stanza)\b/.test(name)) return "verse";
  if (/^(puente|bridge)\b/.test(name)) return "bridge";
  return "other";
}

const DIRECTIVE =/^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;

/** Short directive names defined by the ChordPro spec. */
const ALIASES: Record<string, string> = {
  t: "title",
  st: "subtitle",
  c: "comment",
  ci: "comment",
  comment_italic: "comment",
  soc: "start_of_chorus",
  eoc: "end_of_chorus",
  sov: "start_of_verse",
  eov: "end_of_verse",
  sob: "start_of_bridge",
  eob: "end_of_bridge",
  sot: "start_of_tab",
  eot: "end_of_tab",
};

function parseDirective(name: string, value: string | null, metadata: Record<string, string>): SongLine | null {
  const directive = ALIASES[name.toLowerCase()] ?? name.toLowerCase();
  if (directive === "comment") return { kind: "comment", text: value ?? "" };
  if (directive.startsWith("start_of_")) {
    return { kind: "section-start", section: directive.slice("start_of_".length), label: value || null };
  }
  if (directive.startsWith("end_of_")) {
    return { kind: "section-end", section: directive.slice("end_of_".length) };
  }
  if (CHANGE_DIRECTIVES.has(directive)) {
    // Metadata keeps the first value (the starting one); the line marks
    // where each one applies.
    if (value !== null && !(directive in metadata)) metadata[directive] = value;
    return { kind: "change", directive: directive as ChangeDirective, value: value ?? "" };
  }
  if (value !== null) metadata[directive] = value;
  return null;
}

export function parseLyricsLine(line: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /\[([^\]]*)\]/g;
  let chord: string | null = null;
  let cursor = 0;
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    const text = line.slice(cursor, index);
    if (chord !== null || text !== "") segments.push({ chord, text });
    chord = match[1] ?? "";
    cursor = index + match[0].length;
  }
  const rest = line.slice(cursor);
  if (chord !== null || rest !== "") segments.push({ chord, text: rest });
  return segments;
}

export function parseChordProSong(source: string): ParsedSong {
  const metadata: Record<string, string> = {};
  const lines: SongLine[] = [];
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    if (raw.trimStart().startsWith("#")) continue;
    const directive = DIRECTIVE.exec(raw);
    if (directive) {
      const line = parseDirective(directive[1] ?? "", directive[2] ?? null, metadata);
      if (line) lines.push(line);
      continue;
    }
    if (raw.trim() === "") {
      lines.push({ kind: "empty" });
      continue;
    }
    lines.push({ kind: "lyrics", segments: parseLyricsLine(raw.trimEnd()) });
  }
  return { metadata, lines };
}
