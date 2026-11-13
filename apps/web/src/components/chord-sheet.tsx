import type { ParsedSong, SongLine } from "@acordia/chord-engine";

export interface SectionLabels {
  readonly verse: string;
  readonly chorus: string;
  readonly bridge: string;
  readonly tab: string;
  readonly grid: string;
}

/**
 * Renders a parsed ChordPro song: each chord sits above the syllable it
 * belongs to, and lines wrap on small screens without losing that alignment.
 */
export function ChordSheet({ song, labels }: { song: ParsedSong; labels: SectionLabels }) {
  return (
    <div className="chord-sheet font-mono text-[15px] leading-tight sm:text-base">
      {song.lines.map((line, index) => (
        <Line key={index} line={line} labels={labels} />
      ))}
    </div>
  );
}

function Line({ line, labels }: { line: SongLine; labels: SectionLabels }) {
  switch (line.kind) {
    case "empty":
      return <div className="h-4" aria-hidden="true" />;
    case "comment":
      return <p className="mt-4 mb-1 font-sans text-sm font-semibold uppercase tracking-wide text-muted">{line.text}</p>;
    case "section-start":
      return (
        <p className="mt-4 mb-1 font-sans text-sm font-semibold uppercase tracking-wide text-muted">
          {line.label ?? sectionLabel(line.section, labels)}
        </p>
      );
    case "section-end":
      return null;
    case "lyrics":
      return (
        <div className="flex flex-wrap items-end">
          {line.segments.map((segment, index) => (
            <span key={index} className="inline-flex flex-col">
              <span className="min-h-[1.4em] pr-2 font-bold text-accent">{segment.chord ?? ""}</span>
              <span className="whitespace-pre">{segment.text || (segment.chord ? " " : "")}</span>
            </span>
          ))}
        </div>
      );
  }
}

function sectionLabel(section: string, labels: SectionLabels): string {
  if (section in labels) return labels[section as keyof SectionLabels];
  return section.replace(/_/g, " ");
}
