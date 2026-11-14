import { type ParsedSong, type SectionKind, type SongLine, sectionKindFromLabel } from "@acordia/chord-engine";

export interface SectionLabels {
  readonly verse: string;
  readonly chorus: string;
  readonly bridge: string;
  readonly tab: string;
  readonly grid: string;
}

type LyricsOrEmpty = Extract<SongLine, { kind: "lyrics" } | { kind: "empty" }>;

interface Block {
  kind: SectionKind;
  label: string | null;
  lines: LyricsOrEmpty[];
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

  for (const line of song.lines) {
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
        if (current && current.label === null && current.lines.every((l) => l.kind === "empty")) {
          current.label = line.text;
          current.kind = sectionKindFromLabel(line.text);
        } else {
          current = open(sectionKindFromLabel(line.text), line.text);
        }
        break;
      default:
        (current ??= open("other", null)).lines.push(line);
    }
  }

  return blocks
    .map((block) => ({ ...block, lines: trimEmpty(block.lines) }))
    .filter((block) => block.label !== null || block.lines.length > 0);
}

function trimEmpty(lines: LyricsOrEmpty[]): LyricsOrEmpty[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]?.kind === "empty") start++;
  while (end > start && lines[end - 1]?.kind === "empty") end--;
  return lines.slice(start, end);
}

function sectionLabel(section: string, labels: SectionLabels): string {
  if (section in labels) return labels[section as keyof SectionLabels];
  return section.replace(/_/g, " ");
}

/**
 * Renders a parsed ChordPro song: each chord sits above the syllable it
 * belongs to, and lines wrap on small screens without losing that alignment.
 */
export function ChordSheet({
  song,
  labels,
  fontSize = 18,
  onChord,
  selectedChord = null,
}: {
  song: ParsedSong;
  labels: SectionLabels;
  /** Lyric size in px; chords scale with it. */
  fontSize?: number;
  /** When given, chords become buttons that report their symbol. */
  onChord?: (symbol: string) => void;
  selectedChord?: string | null;
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
              <span
                className={`inline-block rounded-md px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase ${
                  block.kind === "chorus" ? "bg-accent text-accent-foreground" : "bg-surface-strong text-muted"
                }`}
              >
                {block.label}
              </span>
            </h3>
          )}
          <div className="flex flex-col gap-1">
            {block.lines.map((line, i) => (
              <Line key={i} line={line} onChord={onChord} selectedChord={selectedChord} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

interface ChordProps {
  readonly onChord?: ((symbol: string) => void) | undefined;
  readonly selectedChord: string | null;
}

function ChordLabel({ symbol, className, onChord, selectedChord }: ChordProps & { symbol: string; className: string }) {
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

function Line({ line, onChord, selectedChord }: ChordProps & { line: LyricsOrEmpty }) {
  if (line.kind === "empty") return <div className="h-[0.75em]" aria-hidden="true" />;

  const chordOnly = line.segments.every((s) => s.text.trim() === "");
  if (chordOnly) {
    return (
      <div className="flex flex-wrap gap-x-5 gap-y-1 py-0.5">
        {line.segments.map((segment, i) =>
          segment.chord ? (
            <ChordLabel
              key={i}
              symbol={segment.chord}
              className="font-mono text-[0.95em] font-bold text-accent"
              onChord={onChord}
              selectedChord={selectedChord}
            />
          ) : null,
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end leading-snug">
      {line.segments.map((segment, i) => (
        <span key={i} className="inline-flex flex-col">
          <span className="min-h-[1.35em] pr-[0.6em] font-mono text-[0.9em] font-bold text-accent">
            {segment.chord ? (
              <ChordLabel symbol={segment.chord} className="" onChord={onChord} selectedChord={selectedChord} />
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
