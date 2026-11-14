import type { FretPosition } from "@acordia/chord-engine";

const FRETS = 12;
const FRET_W = 30;
const STRING_GAP = 18;
const PAD_X = 22;
const PAD_Y = 14;
const INLAYS = [3, 5, 7, 9];

/**
 * A four-string bass neck, frets 0-12, lowest string at the bottom as players
 * see it. Marks every place the given note can be played.
 */
export function BassFretboard({
  positions,
  stringNames,
  noteName,
  label,
}: {
  positions: readonly FretPosition[];
  /** Low to high, e.g. ["E", "A", "D", "G"]. */
  stringNames: readonly string[];
  noteName: string;
  label: string;
}) {
  const strings = stringNames.length;
  const width = PAD_X + FRETS * FRET_W + 8;
  const height = PAD_Y * 2 + (strings - 1) * STRING_GAP + 12;
  const y = (string: number) => PAD_Y + (strings - 1 - string) * STRING_GAP;
  // Open strings sit left of the nut; fretted notes in the middle of their fret.
  const cx = (fret: number) => (fret === 0 ? PAD_X - 11 : PAD_X + (fret - 0.5) * FRET_W);
  const mid = PAD_Y + ((strings - 1) * STRING_GAP) / 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="w-full">
      {INLAYS.map((fret) => (
        <circle key={fret} cx={cx(fret)} cy={mid} r={3.5} fill="var(--border-strong)" />
      ))}
      <circle cx={cx(12)} cy={mid - STRING_GAP} r={3.5} fill="var(--border-strong)" />
      <circle cx={cx(12)} cy={mid + STRING_GAP} r={3.5} fill="var(--border-strong)" />
      {Array.from({ length: FRETS + 1 }, (_, fret) => (
        <line
          key={fret}
          x1={PAD_X + fret * FRET_W}
          x2={PAD_X + fret * FRET_W}
          y1={PAD_Y}
          y2={y(0)}
          stroke="var(--border-strong)"
          strokeWidth={fret === 0 ? 4 : 1.5}
        />
      ))}
      {stringNames.map((name, string) => (
        <g key={name}>
          <line x1={PAD_X} x2={PAD_X + FRETS * FRET_W} y1={y(string)} y2={y(string)} stroke="var(--muted)" strokeWidth={1 + (strings - string) * 0.5} />
          <text x={4} y={y(string) + 3.5} fontSize={9} fill="var(--muted)" fontFamily="var(--font-mono)">
            {name}
          </text>
        </g>
      ))}
      {[3, 5, 7, 9, 12].map((fret) => (
        <text key={fret} x={cx(fret)} y={height - 2} textAnchor="middle" fontSize={8} fill="var(--muted)" fontFamily="var(--font-mono)">
          {fret}
        </text>
      ))}
      {positions.map(({ string, fret }) => (
        <g key={`${string}-${fret}`}>
          <circle cx={cx(fret)} cy={y(string)} r={7.5} fill="var(--accent)" />
          <text x={cx(fret)} y={y(string) + 3} textAnchor="middle" fontSize={7.5} fontWeight={700} fill="var(--accent-foreground)">
            {noteName}
          </text>
        </g>
      ))}
    </svg>
  );
}
