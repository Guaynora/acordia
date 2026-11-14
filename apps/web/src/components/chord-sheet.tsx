import type { MouseEvent, ReactNode } from "react";
import {
  type Key,
  type ParsedSong,
  type SectionKind,
  type SongLine,
  chordDegree,
  parseRamp,
  sectionKindFromLabel,
} from "@acordia/chord-engine";
import { lineBars } from "@/domain/scroll-timeline";
import { format } from "@/i18n/format";
import type { SheetView } from "./use-sheet-view";

export interface SectionLabels {
  readonly verse: string;
  readonly chorus: string;
  readonly bridge: string;
  readonly tab: string;
  readonly grid: string;
}

/** How tempo, meter and key changes read on the sheet. */
export interface ChangeLabels {
  /** "♩ = {bpm}" */
  readonly tempo: string;
  /** "{from} → {to} BPM in {bars} bars" */
  readonly ramp: string;
  /** "Key: {key}" */
  readonly key: string;
  /** Endings, segno and coda marks, D.S. and D.C. jumps. */
  readonly markers: {
    /** "{n}." */
    readonly ending: string;
    readonly x_segno: string;
    readonly x_coda: string;
    readonly x_to_coda: string;
    readonly x_fine: string;
    readonly x_ds_al_coda: string;
    readonly x_dc_al_coda: string;
    readonly x_ds_al_fine: string;
    readonly x_dc_al_fine: string;
  };
}

type LyricsOrEmpty = Extract<SongLine, { kind: "lyrics" } | { kind: "empty" }>;
/** A tempo, meter or key change, or a repeat/jump marker: both show as tags. */
type ChangeLine = Extract<SongLine, { kind: "change" } | { kind: "marker" }>;
/** Change directives written together, shown as one row of tags. */
interface ChangeGroup {
  readonly kind: "changes";
  readonly changes: ChangeLine[];
}

/** A line to render, with its index in the parsed song's `lines`. */
interface IndexedLine {
  line: LyricsOrEmpty | ChangeGroup;
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
  // Directives before the first lyrics restate the song's own values,
  // which the page header already shows.
  const firstLyrics = song.lines.findIndex((line) => line.kind === "lyrics");

  song.lines.forEach((line, index) => {
    switch (line.kind) {
      case "change":
      case "marker": {
        // A segno may come first; tempo and key before the lyrics repeat the song's own.
        if (line.kind === "change" && (firstLyrics < 0 || index < firstLyrics)) break;
        const block: Block = (current ??= open("other", null));
        const last = block.lines.at(-1)?.line;
        if (last?.kind === "changes") last.changes.push(line);
        else block.lines.push({ line: { kind: "changes", changes: [line] }, index });
        break;
      }
      case "section-start": {
        const kind = KNOWN_SECTIONS.has(line.section) ? (line.section as SectionKind) : "other";
        current = open(kind, line.label ?? sectionLabel(line.section, labels));
        break;
      }
      case "section-end":
        current = open("other", null);
        break;
      case "comment":
        if (current && current.label === null && current.lines.every((l) => l.line.kind !== "lyrics")) {
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
  changeLabels,
  view = "chords",
  keys,
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
  /** How to word tempo, meter and key changes; without it they show as written. */
  changeLabels?: ChangeLabels;
  view?: SheetView;
  /** Key in force at each line, for the degrees view. */
  keys?: readonly Key[];
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
            {block.lines.map(({ line, index }) =>
              line.kind === "changes" ? (
                <Changes key={index} changes={line.changes} labels={changeLabels} />
              ) : (
                <Line
                  key={index}
                  line={line}
                  index={index}
                  playing={playing?.line === index ? playing.segment : undefined}
                  onStart={onStartFrom}
                  onChord={onChord}
                  selectedChord={selectedChord}
                  view={view}
                  lineKey={keys?.[index]}
                />
              ),
            )}
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

/** Bar lines and repeat signs: "|", "||", "|:", ":|" and ":|x3". */
const BAR_SIGN = /:?\|+:?(?:\s*\(?x\d+\)?)?/gi;

/** A bar line, quiet so the lyrics stay easy to read; repeat signs stand out a little more. */
function BarLine({ sign }: { sign: string }) {
  const repeat = sign.includes(":");
  return (
    <span
      aria-hidden="true"
      className={`font-mono ${repeat ? "font-bold text-secondary" : "font-normal text-muted/60"}`}
    >
      {sign.replace(/\s+/g, "")}
    </span>
  );
}

/** Lyrics with their bar lines and repeat signs drawn as such. */
function withBarLines(text: string): ReactNode {
  if (!text.includes("|")) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(BAR_SIGN)) {
    const at = match.index ?? 0;
    parts.push(text.slice(cursor, at), <BarLine key={at} sign={match[0]} />);
    cursor = at + match[0].length;
  }
  parts.push(text.slice(cursor));
  return parts;
}

/** One change as the sheet shows it: "♩ = 140", "7/8", "(2+2+3)", "Key: Ab", a ramp. */
function changeText(change: ChangeLine, labels: ChangeLabels | undefined): string {
  const value = change.value.trim();
  if (!labels) return value ? `${change.directive}: ${value}` : change.directive;
  if (change.kind === "marker") {
    if (change.directive === "x_ending") return format(labels.markers.ending, { n: value.replace(/\.$/, "") });
    return labels.markers[change.directive];
  }
  switch (change.directive) {
    case "tempo":
      return format(labels.tempo, { bpm: value });
    case "time":
      return value.replace(/\s+/g, "");
    case "x_groups":
      return `(${value.replace(/\s+/g, "")})`;
    case "key":
      return format(labels.key, { key: value });
    case "x_ramp": {
      const ramp = parseRamp(value);
      return ramp ? format(labels.ramp, { from: ramp.from, to: ramp.to, bars: ramp.bars }) : value;
    }
  }
}

/** Tags marking where the tempo, meter or key changes. */
function Changes({ changes, labels }: { changes: readonly ChangeLine[]; labels: ChangeLabels | undefined }) {
  return (
    <p className="flex flex-wrap gap-1.5 py-1 font-mono text-[11px] font-semibold">
      {changes.map((change, i) => (
        <span key={i} className="rounded-md bg-secondary-soft px-2 py-0.5 text-secondary">
          {changeText(change, labels)}
        </span>
      ))}
    </p>
  );
}

interface ChordProps {
  readonly onChord?: ((symbol: string) => void) | undefined;
  readonly selectedChord: string | null;
}

const PLAYING_CHORD = "rounded bg-secondary text-secondary-foreground";

/** A chord as a scale degree: the number, its suffix raised (5⁷, not 57), and the bass degree. */
function DegreeText({ symbol, lineKey }: { symbol: string; lineKey: Key }) {
  const degree = chordDegree(symbol, lineKey);
  if (!degree) return <>{symbol}</>;
  return (
    <>
      {degree.degree}
      {degree.suffix && <sup className="text-[0.7em]">{degree.suffix}</sup>}
      {degree.bass && `/${degree.bass}`}
    </>
  );
}

function ChordLabel({
  symbol,
  className,
  onChord,
  selectedChord,
  playing = false,
  lineKey,
}: ChordProps & { symbol: string; className: string; playing?: boolean; lineKey?: Key | undefined }) {
  if (playing) className = `${className} ${PLAYING_CHORD}`;
  // In the degrees view the chord reads as a number but still opens its diagram.
  const shown = lineKey ? <DegreeText symbol={symbol} lineKey={lineKey} /> : symbol;
  if (!onChord) return <span className={className}>{shown}</span>;
  return (
    <button
      type="button"
      onClick={() => onChord(symbol)}
      aria-pressed={selectedChord === symbol}
      className={`${className} -mx-0.5 cursor-pointer rounded px-0.5 text-left hover:bg-accent-soft aria-pressed:bg-accent aria-pressed:text-accent-foreground`}
    >
      {shown}
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
  view,
  lineKey,
}: ChordProps & {
  line: LyricsOrEmpty;
  index: number;
  /** Playing segment of this line, null for the whole line, undefined if not playing. */
  playing: number | null | undefined;
  onStart?: ((line: number) => void) | undefined;
  view: SheetView;
  lineKey: Key | undefined;
}) {
  if (line.kind === "empty") return view === "grid" ? null : <div className="h-[0.75em]" aria-hidden="true" />;
  const degreeKey = view === "degrees" ? lineKey : undefined;

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

  // Bar lines alone do not make a line lyrics: "| G | C D |" is chords.
  const chordOnly = line.segments.every((s) => s.text.replace(/\|/g, "").trim() === "");

  if (view === "grid") {
    return (
      <GridLine
        line={line}
        index={index}
        playing={playing}
        start={start}
        marker={marker}
        onChord={onChord}
        selectedChord={selectedChord}
      />
    );
  }

  if (view === "lyrics") {
    // Singers get the words; a line of only chords has none.
    if (chordOnly) return null;
    const words = line.segments
      .map((segment) => segment.text)
      .join("")
      .replace(BAR_SIGN, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const lyricMarker = playing !== undefined ? " -ml-3 border-l-4 border-secondary pl-2" : marker;
    return (
      <p data-line={index} onClick={start} className={`leading-snug${lyricMarker}`}>
        {words}
      </p>
    );
  }

  if (chordOnly) {
    return (
      <div
        data-line={index}
        onClick={start}
        className={`flex flex-wrap items-baseline gap-x-5 gap-y-1 py-0.5${marker}`}
      >
        {line.segments.flatMap((segment, i) => [
          segment.chord ? (
            <ChordLabel
              key={`c${i}`}
              symbol={segment.chord}
              className="font-mono text-[0.95em] font-bold text-accent"
              onChord={onChord}
              selectedChord={selectedChord}
              playing={playing === i}
              lineKey={degreeKey}
            />
          ) : null,
          ...Array.from(segment.text.matchAll(BAR_SIGN), (match, b) => <BarLine key={`b${i}-${b}`} sign={match[0]} />),
        ])}
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
                lineKey={degreeKey}
              />
            ) : (
              ""
            )}
          </span>
          <span className="whitespace-pre">{withBarLines(segment.text || (segment.chord ? " " : ""))}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * A line as a row of bars, without lyrics: the chords of each bar in a cell,
 * "%" for a bar that holds the chord before it. Bars come from the same
 * rules the scroll timeline times, so the grid and playback agree.
 */
function GridLine({
  line,
  index,
  playing,
  start,
  marker,
  onChord,
  selectedChord,
}: ChordProps & {
  line: Extract<SongLine, { kind: "lyrics" }>;
  index: number;
  playing: number | null | undefined;
  start: ((event: MouseEvent) => void) | undefined;
  marker: string;
}) {
  const bars = lineBars(line);
  if (bars.length === 0) return null;
  const text = line.segments.map((segment) => segment.text).join("");
  const opens = /\|:/.test(text);
  const closes = /:\|(?:\s*\(?x\d+\)?)?/i.exec(text)?.[0].replace(/[\s()]/g, "");
  return (
    <div data-line={index} onClick={start} className={`flex flex-wrap items-stretch py-0.5 font-mono${marker}`}>
      {opens && <span className="self-center pr-1 font-bold text-secondary">|:</span>}
      {bars.map((chords, b) => (
        <span key={b} className="flex min-w-[4.5em] items-center gap-2 border-l-2 border-border-strong px-2 py-1">
          {chords.length === 0 ? (
            <span className="text-muted">%</span>
          ) : (
            chords.map((segment) => (
              <ChordLabel
                key={segment}
                symbol={line.segments[segment]?.chord ?? ""}
                className="font-bold text-accent"
                onChord={onChord}
                selectedChord={selectedChord}
                playing={playing === segment}
              />
            ))
          )}
        </span>
      ))}
      <span className="border-l-2 border-border-strong" aria-hidden="true" />
      {closes && <span className="self-center pl-1 font-bold text-secondary">{closes}</span>}
    </div>
  );
}
