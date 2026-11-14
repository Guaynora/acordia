import type { FretShape } from "@acordia/chord-engine";

const GAP = 18;
const FRET_H = 22;
const ROWS = 5;
const TOP = 26;
const LEFT = 26;

/**
 * Classic chord box: strings run top to bottom (lowest on the left), frets
 * across. Shows open (o) and muted (×) strings, finger numbers and barres.
 * Shapes higher up the neck start at their lowest fret, labelled on the left.
 */
export function ChordDiagram({
  shape,
  stringNames,
  label,
}: {
  shape: FretShape;
  stringNames: readonly string[];
  label: string;
}) {
  const strings = shape.frets.length;
  const fretted = shape.frets.filter((f) => f > 0);
  const highest = fretted.length > 0 ? Math.max(...fretted) : 0;
  const lowest = fretted.length > 0 ? Math.min(...fretted) : 1;
  const start = highest <= ROWS ? 1 : lowest;
  const width = LEFT + (strings - 1) * GAP + 16;
  const height = TOP + ROWS * FRET_H + 18;
  const x = (string: number) => LEFT + string * GAP;
  const y = (fret: number) => TOP + (fret - start + 0.5) * FRET_H;

  const barres = (shape.barres ?? []).map((fret) => {
    const on = shape.frets.flatMap((f, s) => (f === fret ? [s] : []));
    return { fret, from: Math.min(...on), to: Math.max(...on) };
  });
  const inBarre = (string: number, fret: number) =>
    barres.some((b) => b.fret === fret && string > b.from && string < b.to);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="mx-auto h-auto w-full max-w-48">
      {start > 1 && (
        <text x={LEFT - 10} y={y(start) + 4} textAnchor="end" fontSize={10} fill="var(--muted)" fontFamily="var(--font-mono)">
          {start}
        </text>
      )}
      {/* Nut, or a thin top line when the shape sits higher up */}
      <line x1={x(0)} x2={x(strings - 1)} y1={TOP} y2={TOP} stroke="var(--foreground)" strokeWidth={start === 1 ? 4 : 1.5} />
      {Array.from({ length: ROWS }, (_, i) => (
        <line key={i} x1={x(0)} x2={x(strings - 1)} y1={TOP + (i + 1) * FRET_H} y2={TOP + (i + 1) * FRET_H} stroke="var(--border-strong)" strokeWidth={1.5} />
      ))}
      {shape.frets.map((_, string) => (
        <line key={string} x1={x(string)} x2={x(string)} y1={TOP} y2={TOP + ROWS * FRET_H} stroke="var(--muted)" strokeWidth={1.2} />
      ))}
      {shape.frets.map((fret, string) =>
        fret <= 0 ? (
          <text key={string} x={x(string)} y={TOP - 8} textAnchor="middle" fontSize={11} fill="var(--muted)" fontWeight={700}>
            {fret === 0 ? "o" : "×"}
          </text>
        ) : null,
      )}
      {barres.map((b) => (
        <rect
          key={b.fret}
          x={x(b.from) - 8}
          y={y(b.fret) - 8}
          width={x(b.to) - x(b.from) + 16}
          height={16}
          rx={8}
          fill="var(--accent)"
        />
      ))}
      {shape.frets.map((fret, string) => {
        if (fret <= 0 || inBarre(string, fret)) return null;
        const finger = shape.fingers?.[string];
        return (
          <g key={string}>
            <circle cx={x(string)} cy={y(fret)} r={8} fill="var(--accent)" />
            {finger ? (
              <text x={x(string)} y={y(fret) + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--accent-foreground)">
                {finger}
              </text>
            ) : null}
          </g>
        );
      })}
      {stringNames.map((name, string) => (
        <text key={string} x={x(string)} y={height - 3} textAnchor="middle" fontSize={9} fill="var(--muted)" fontFamily="var(--font-mono)">
          {name}
        </text>
      ))}
    </svg>
  );
}
