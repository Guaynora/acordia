import {
  type SongLine,
  type TempoRamp,
  parseGroups,
  parseKey,
  parseRamp,
  parseTempoValue,
  parseTimeSignature,
} from "@acordia/chord-engine";
import { type Meter, meterFor } from "./meter";
import type { ScrollTimeline } from "./scroll-timeline";
import { MAX_TEMPO, MIN_TEMPO } from "./song";

/**
 * Tempo, meter and key along a song, anchored to bars (not seconds), the
 * way a DAW or a MIDI file does it. The song's own values open the map;
 * each change directive in the sheet starts a new section from the bar
 * where it appears, and everything it does not change is inherited.
 */

export interface TempoSection {
  /** First bar, counted like the scroll timeline (0 = the song's first chord). */
  readonly bar: number;
  /** Tempo once any ramp is over. */
  readonly bpm: number;
  readonly meter: Meter;
  /** Accelerando or ritardando starting at `bar`. */
  readonly ramp: TempoRamp | null;
  /** Key name as written, e.g. "Ab". */
  readonly key: string;
}

export interface TempoMap {
  readonly sections: readonly TempoSection[];
}

export interface TempoStart {
  readonly bpm: number;
  readonly signature: string;
  readonly key: string;
}

const clampBpm = (bpm: number) => Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, bpm));

export function buildTempoMap(lines: readonly SongLine[], timeline: ScrollTimeline, start: TempoStart): TempoMap {
  let bpm = clampBpm(start.bpm);
  let signature = start.signature;
  let groups: number[] | null = null;
  let key = start.key;
  let ramp: TempoRamp | null = null;
  // A ramp belongs to the bar it was written at; later sections start steady.
  let rampBar = -1;
  const sections: TempoSection[] = [{ bar: 0, bpm, meter: meterFor(signature), ramp: null, key }];

  // Directives before the first lyric line restate the song's values,
  // which the song itself already provides.
  const firstLyrics = lines.findIndex((line) => line.kind === "lyrics");

  // Changes in the order they are reached, so one inside a repeat applies on every pass.
  for (const { line: index, bar } of timeline.marks) {
    const line = lines[index];
    if (line?.kind !== "change" || firstLyrics < 0 || index < firstLyrics) continue;
    switch (line.directive) {
      case "tempo": {
        const value = parseTempoValue(line.value);
        if (value === null) continue;
        bpm = clampBpm(value);
        ramp = null;
        break;
      }
      case "time":
        if (!parseTimeSignature(line.value)) continue;
        signature = line.value.replace(/\s+/g, "");
        // A grouping belongs to its meter.
        groups = null;
        break;
      case "x_groups":
        groups = parseGroups(line.value);
        break;
      case "x_ramp": {
        const parsed = parseRamp(line.value);
        if (!parsed) continue;
        ramp = { from: clampBpm(parsed.from), to: clampBpm(parsed.to), bars: parsed.bars };
        rampBar = bar;
        bpm = ramp.to;
        break;
      }
      case "key":
        if (!parseKey(line.value)) continue;
        key = line.value.trim();
        break;
    }

    const section: TempoSection = {
      bar,
      bpm,
      meter: meterFor(signature, groups),
      ramp: rampBar === bar ? ramp : null,
      key,
    };
    // Changes written together form one section.
    if (sections.at(-1)?.bar === bar) sections[sections.length - 1] = section;
    else sections.push(section);
  }

  return { sections };
}

/** True when nothing changes after the start. */
export function isSteady(map: TempoMap): boolean {
  return map.sections.length <= 1 && !map.sections[0]?.ramp;
}

export function sectionAt(map: TempoMap, bar: number): TempoSection {
  let found = map.sections[0];
  for (const section of map.sections) {
    if (section.bar <= bar) found = section;
    else break;
  }
  if (!found) throw new Error("A tempo map always has a first section");
  return found;
}

/** Tempo at a position in bars (fractions allowed), following any ramp. */
export function bpmAt(map: TempoMap, bar: number): number {
  const section = sectionAt(map, bar);
  const { ramp } = section;
  if (!ramp) return section.bpm;
  const progress = (bar - section.bar) / ramp.bars;
  if (progress >= 1) return ramp.to;
  return ramp.from + (ramp.to - ramp.from) * Math.max(0, progress);
}

/** The next section after `bar`, to warn the player before it arrives. */
export function nextSection(map: TempoMap, bar: number): TempoSection | null {
  return map.sections.find((section) => section.bar > bar) ?? null;
}
