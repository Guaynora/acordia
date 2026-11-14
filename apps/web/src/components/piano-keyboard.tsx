/** Which pitch classes are black keys, and the white-key index of each white one. */
const BLACK = new Set([1, 3, 6, 8, 10]);
const WHITE_INDEX: Record<number, number> = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 };

const WHITE_W = 20;
const WHITE_H = 84;
const BLACK_W = 12;
const BLACK_H = 52;

/**
 * A keyboard from `from` to `to` (MIDI, inclusive, whole octaves) with the
 * left-hand and right-hand notes marked. `names` maps a pitch class to the
 * spelled note name to print on the key.
 */
export function PianoKeyboard({
  from,
  to,
  left,
  right,
  names,
  label,
}: {
  from: number;
  to: number;
  left: readonly number[];
  right: readonly number[];
  names: ReadonlyMap<number, string>;
  label: string;
}) {
  const keys = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const whites = keys.filter((m) => !BLACK.has(m % 12));
  const x = (midi: number) => {
    const octave = Math.floor((midi - from) / 12);
    return (octave * 7 + (WHITE_INDEX[midi % 12] ?? 0)) * WHITE_W;
  };
  const role = (midi: number) => (left.includes(midi) ? "left" : right.includes(midi) ? "right" : null);
  const fill = (midi: number, black: boolean) => {
    const r = role(midi);
    if (r === "left") return "var(--secondary)";
    if (r === "right") return "var(--accent)";
    return black ? "var(--foreground)" : "var(--card)";
  };
  const ink = (midi: number) => (role(midi) === "left" ? "var(--secondary-foreground)" : "var(--accent-foreground)");
  const width = whites.length * WHITE_W;

  return (
    <svg viewBox={`-1 -1 ${width + 2} ${WHITE_H + 2}`} role="img" aria-label={label} className="w-full">
      {whites.map((midi) => (
        <g key={midi}>
          <rect x={x(midi)} y={0} width={WHITE_W} height={WHITE_H} rx={3} fill={fill(midi, false)} stroke="var(--border-strong)" />
          {role(midi) && (
            <text x={x(midi) + WHITE_W / 2} y={WHITE_H - 8} textAnchor="middle" fontSize={9} fontWeight={700} fill={ink(midi)}>
              {names.get(midi % 12)}
            </text>
          )}
        </g>
      ))}
      {keys
        .filter((m) => BLACK.has(m % 12))
        .map((midi) => {
          const bx = x(midi - 1) + WHITE_W - BLACK_W / 2;
          return (
            <g key={midi}>
              <rect x={bx} y={0} width={BLACK_W} height={BLACK_H} rx={2} fill={fill(midi, true)} stroke="var(--border-strong)" />
              {role(midi) && (
                <text x={bx + BLACK_W / 2} y={BLACK_H - 6} textAnchor="middle" fontSize={7} fontWeight={700} fill={ink(midi)}>
                  {names.get(midi % 12)}
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}
