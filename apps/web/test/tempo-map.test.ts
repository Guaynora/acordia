import { parseChordProSong } from "@acordia/chord-engine";
import { describe, expect, it } from "vitest";
import { buildScrollTimeline } from "@/domain/scroll-timeline";
import { bpmAt, buildTempoMap, isSteady, nextSection, sectionAt } from "@/domain/tempo-map";

const START = { bpm: 92, signature: "4/4", key: "G" };

function mapOf(source: string) {
  const song = parseChordProSong(source);
  return buildTempoMap(song.lines, buildScrollTimeline(song.lines), START);
}

// Four bars of verse, a 7/8 bridge at 140 from bar 4, and a last chorus
// in Ab from bar 6 slowing from 140 to 120 over 4 bars.
const SONG = `{key: G}
{tempo: 92}
{start_of_verse}
[G]one [C]two
[D]three [G]four
{end_of_verse}
{start_of_bridge}
{time: 7/8}
{x_groups: 2+2+3}
{tempo: 140}
[Em]five [C]six
{end_of_bridge}
{start_of_chorus}
{key: Ab}
{x_ramp: 140-120 4}
[Ab]seven [Db]eight [Eb]nine [Ab]ten
{end_of_chorus}`;

describe("tempo map", () => {
  const map = mapOf(SONG);

  it("opens with the song's values and ignores the header directives", () => {
    expect(map.sections[0]).toMatchObject({ bar: 0, bpm: 92, key: "G", ramp: null });
    expect(map.sections[0]?.meter.signature).toBe("4/4");
  });

  it("starts a section at the bar where its changes are written, merging changes written together", () => {
    expect(map.sections.map((s) => s.bar)).toEqual([0, 4, 6]);
    const bridge = sectionAt(map, 5);
    expect(bridge.bpm).toBe(140);
    expect(bridge.meter.signature).toBe("7/8");
    expect(bridge.meter.groups).toEqual([2, 2, 3]);
  });

  it("inherits what a section does not change", () => {
    const chorus = sectionAt(map, 6);
    expect(chorus.meter.signature).toBe("7/8");
    expect(chorus.key).toBe("Ab");
  });

  it("follows a ramp and holds its last tempo after it", () => {
    expect(bpmAt(map, 6)).toBe(140);
    expect(bpmAt(map, 8)).toBe(130);
    expect(bpmAt(map, 9.5)).toBe(122.5);
    expect(bpmAt(map, 10)).toBe(120);
  });

  it("names the next section, for warning before it arrives", () => {
    expect(nextSection(map, 3)?.bar).toBe(4);
    expect(nextSection(map, 6)).toBeNull();
  });

  it("drops the grouping when the meter changes again", () => {
    const later = mapOf("[C]a\n{time: 7/8}\n{x_groups: 3+2+2}\n[C]b\n{time: 7/8}\n[C]c");
    expect(sectionAt(later, 2).meter.groups).toBeUndefined();
  });

  it("does not carry a ramp into a later section", () => {
    const later = mapOf("[C]a\n{x_ramp: 100-120 1}\n[C]b\n{key: D}\n[D]c");
    expect(sectionAt(later, 2).ramp).toBeNull();
    expect(sectionAt(later, 2).bpm).toBe(120);
  });

  it("is steady for a song without changes", () => {
    expect(isSteady(mapOf("{tempo: 92}\n[G]one [C]two"))).toBe(true);
    expect(isSteady(map)).toBe(false);
  });

  it("skips values it cannot read", () => {
    expect(mapOf("[C]a\n{tempo: fast}\n{time: 7/7}\n[C]b").sections).toHaveLength(1);
  });
});
