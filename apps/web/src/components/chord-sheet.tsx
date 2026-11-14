import type { MouseEvent } from "react";
import { type ParsedSong, type SectionKind, type SongLine, sectionKindFromLabel } from "@acordia/chord-engine";

export interface SectionLabels {
  readonly verse: string;
  readonly chorus: string;
  readonly bridge: string;
  readonly tab: string;
  readonly grid: string;
}

type LyricsOrEmpty = Extract<SongLine, { kind: "lyrics" } | { kind: "empty" }>;

/** A line to render, with its index in the parsed song's `lines`. */
interface IndexedLine {
  line: LyricsOrEmpty;
  index: number;
}

interface Block {
  kind: SectionKind;
  label: string | null;
  lines: IndexedLine[];
}

/** What auto-scroll is playing: a chord, or a whole line without chords. */
export interface PlayingPosition {
  /** Index into the parsed song's `lines`. */
  readonly line: number;
  /** Segment of that line whose chord sounds, or null for the whole line. */
  readonly segment: number | null;
}

const KNOWN_SECTIONS = new Set<string>(["verse", "chorus", "bridge"]);

/**
 * Groups lines into sections. Explicit ChordPro sections win; a plain
 * comment such as "Coro" also opens a section, so older imports get the
 * same look.
 */
function toBlocks(song: ParsedSong, labels: SectionLabels): Block[] {
  const blocks: Block[] = [];
  const open = (kind: SectionKind, label: string | null) => {
    const block: Block = { kind, label, lines: [] };
    blocks.push(block);
    return block;
  };
  let current: Block | null = null;

  song.lines.forEach((line, index) => {
    switch (line.kind) {
      case "section-start": {
        const kind = KNOWN_SECTIONS.has(line.section) ? (line.section as SectionKind) : "other";
        current = open(kind, line.label ?? sectionLabel(line.section, labels));
        break;
      }
      case "section-end":
        current = open("other", null);
        break;
      case "comment":
        if (current && current.label === null && current.lines.every((l) => l.line.kind === "empty")) {
          current.label = line.text;
          current.kind = sectionKindFromLabel(line.text);
        } else {
          current = open(sectionKindFromLabel(line.text), line.text);
        }
        break;
      default:
        (current ??= open("other", null)).lines.push({ line, index });
    }
  });

  return blocks
    .map((block) => ({ ...block, lines: trimEmpty(block.lines) }))
    .filter((block) => block.label !== null || block.lines.length > 0);
}

function trimEmpty(lines: IndexedLine[]): IndexedLine[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]?.line.kind === "empty") start++;
  while (end > start && lines[end - 1]?.line.kind === "empty") end--;
  return lines.slice(start, end);
}

function sectionLabel(section: string, labels: SectionLabels): string {
  if (section in labels) return labels[section as keyof SectionLabels];
  return section.replace(/_/g, " ");
}

/**
 * Renders a parsed ChordPro song: each chord sits above the syllable it
 * belongs to, and lines wrap on small screens without losing that alignment.
 * Each lyric line carries `data-line` (its index in `song.lines`) so
 * auto-scroll can find it.
 */
export function ChordSheet({
  song,
  labels,
  fontSize = 18,
  onChord,
  selectedChord = null,
  playing = null,
  onStartFrom,
}: {
  song: ParsedSong;
  labels: SectionLabels;
  /** Lyric size in px; chords scale with it. */
  fontSize?: number;
  /** When given, chords become buttons that report their symbol. */
  onChord?: (symbol: string) => void;
  selectedChord?: string | null;
  /** Highlighted while auto-scroll plays. */
  playing?: PlayingPosition | null;
  /**
   * When given, tapping a line's lyrics or a section label starts auto-scroll
   * there (the line's index in `song.lines`). Chords keep their own action.
   */
  onStartFrom?: (line: number) => void;
}) {
  return (
    <div className="flex flex-col gap-7" style={{ fontSize }}>
      {toBlocks(song, labels).map((block, index) => (
        <section
          key={index}
          className={
            block.kind === "chorus"
              ? "-mx-3 flex flex-col gap-3 rounded-xl border-l-4 border-accent bg-surface px-4 py-4 sm:-mx-4 sm:px-5"
              : "flex flex-col gap-3"
          }
        >
          {block.label && (
            <h3>
              <SectionLabel
                label={block.label}
                chorus={block.kind === "chorus"}
                onStart={onStartFrom && block.lines[0] ? () => onStartFrom(block.lines[0]?.index ?? 0) : undefined}
              />
            </h3>
          )}
          <div className="flex flex-col gap-1">
            {block.lines.map(({ line, index }) => (
              <Line
                key={index}
                line={line}
                index={index}
                playing={playing?.line === index ? playing.segment : undefined}
                onStart={onStartFrom}
                onChord={onChord}
                selectedChord={selectedChord}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SectionLabel({
  label,
  chorus,
  onStart,
}: {
  label: string;
  chorus: boolean;
  onStart?: (() => void) | undefined;
}) {
  const className = `inline-block rounded-md px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase ${
    chorus ? "bg-accent text-accent-foreground" : "bg-surface-strong text-muted"
  }`;
  if (!onStart) return <span className={className}>{label}</span>;
  return (
    <button
      type="button"
      onClick={onStart}
      className={`${className} cursor-pointer hover:ring-2 hover:ring-secondary focus-visible:ring-2 focus-visible:ring-secondary`}
    >
      {label} <span aria-hidden="true">▸</span>
    </button>
  );
}

interface ChordProps {
  readonly onChord?: ((symbol: string) => void) | undefined;
  readonly selectedChord: string | null;
}

const PLAYING_CHORD = "rounded bg-secondary text-secondary-foreground";

function ChordLabel({
  symbol,
  className,
  onChord,
  selectedChord,
  playing = false,
}: ChordProps & { symbol: string; className: string; playing?: boolean }) {
  if (playing) className = `${className} ${PLAYING_CHORD}`;
  if (!onChord) return <span className={className}>{symbol}</span>;
  return (
    <button
      type="button"
      onClick={() => onChord(symbol)}
      aria-pressed={selectedChord === symbol}
      className={`${className} -mx-0.5 cursor-pointer rounded px-0.5 text-left hover:bg-accent-soft aria-pressed:bg-accent aria-pressed:text-accent-foreground`}
    >
      {symbol}
    </button>
  );
}

function Line({
  line,
  index,
  playing,
  onStart,
  onChord,
  selectedChord,
}: ChordProps & {
  line: LyricsOrEmpty;
  index: number;
  /** Playing segment of this line, null for the whole line, undefined if not playing. */
  playing: number | null | undefined;
  onStart?: ((line: number) => void) | undefined;
}) {
  if (line.kind === "empty") return <div className="h-[0.75em]" aria-hidden="true" />;

  // A line without chords plays as a whole: mark it with a bar on its left.
  const marker =
    (playing === null ? " -ml-3 border-l-4 border-secondary pl-2" : " border-l-4 border-transparent -ml-3 pl-2") +
    (onStart ? " cursor-pointer rounded-r-md hover:bg-surface-strong/60" : "");
  // Tapping the lyrics starts there; a tap on a chord stays the chord's.
  // Keyboard users start from a section label, which is a button.
  const start = onStart
    ? (event: MouseEvent) => {
        if (!(event.target as HTMLElement).closest("button")) onStart(index);
      }
    : undefined;

  const chordOnly = line.segments.every((s) => s.text.trim() === "");
  if (chordOnly) {
    return (
      <div data-line={index} onClick={start} className={`flex flex-wrap gap-x-5 gap-y-1 py-0.5${marker}`}>
        {line.segments.map((segment, i) =>
          segment.chord ? (
            <ChordLabel
              key={i}
              symbol={segment.chord}
              className="font-mono text-[0.95em] font-bold text-accent"
              onChord={onChord}
              selectedChord={selectedChord}
              playing={playing === i}
            />
          ) : null,
        )}
      </div>
    );
  }

  return (
    <div data-line={index} onClick={start} className={`flex flex-wrap items-end leading-snug${marker}`}>
      {line.segments.map((segment, i) => (
        <span key={i} className="inline-flex flex-col">
          <span className="min-h-[1.35em] pr-[0.6em] font-mono text-[0.9em] font-bold text-accent">
            {segment.chord ? (
              <ChordLabel
                symbol={segment.chord}
                className=""
                onChord={onChord}
                selectedChord={selectedChord}
                playing={playing === i}
              />
            ) : (
              ""
            )}
          </span>
          <span className="whitespace-pre">{segment.text || (segment.chord ? " " : "")}</span>
        </span>
      ))}
    </div>
  );
}
