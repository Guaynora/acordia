/** Tempo the metronome starts at when a song gives none. */
export const DEFAULT_PRACTICE_BPM = 90;

/**
 * Classic tempo markings by BPM. The ranges overlap in practice; these are
 * the commonly cited boundaries, good enough to describe a song's feel.
 */
export type TempoMarking = "largo" | "adagio" | "andante" | "moderato" | "allegro" | "presto";

const RANGES: readonly { readonly upTo: number; readonly marking: TempoMarking }[] = [
  { upTo: 59, marking: "largo" },
  { upTo: 75, marking: "adagio" },
  { upTo: 107, marking: "andante" },
  { upTo: 119, marking: "moderato" },
  { upTo: 167, marking: "allegro" },
  { upTo: Infinity, marking: "presto" },
];

export function tempoMarking(bpm: number): TempoMarking {
  return RANGES.find((range) => bpm <= range.upTo)?.marking ?? "presto";
}
