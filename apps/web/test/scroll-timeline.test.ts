import { parseChordProSong } from "@acordia/chord-engine";
import { describe, expect, it } from "vitest";
import { buildScrollTimeline, stepIndexAt } from "@/domain/scroll-timeline";

const timelineOf = (source: string) => buildScrollTimeline(parseChordProSong(source).lines);

describe("scroll timeline", () => {
  it("gives each chord one bar, in order", () => {
    const timeline = timelineOf("[G]Walking down the [D/F#]road\n[Em7]Under a [Cadd9]silver sky");
    expect(timeline.steps.map((s) => [s.line, s.segment, s.startBar])).toEqual([
      [0, 0, 0],
      [0, 1, 1],
      [1, 0, 2],
      [1, 1, 3],
    ]);
    expect(timeline.totalBars).toBe(4);
  });

  it("indexes lines in the parsed song, skipping directives and blanks", () => {
    const timeline = timelineOf("{title: X}\n{start_of_verse}\n[C]One\n\n[F]Two\n{end_of_verse}");
    // {title} is metadata, not a line; the section start is line 0.
    expect(timeline.steps.map((s) => s.line)).toEqual([1, 3]);
  });

  it("gives a lyric line without chords two bars", () => {
    const timeline = timelineOf("[C]With chords\nSung without chords\n[G]Back");
    expect(timeline.steps.map((s) => [s.segment, s.bars])).toEqual([
      [0, 1],
      [null, 2],
      [0, 1],
    ]);
    expect(timeline.totalBars).toBe(4);
  });

  it("does not time a pickup before the first chord", () => {
    const timeline = timelineOf("And [C]then");
    expect(timeline.steps).toEqual([{ line: 0, segment: 1, startBar: 0, bars: 1 }]);
  });

  it("counts chord-only lines and N.C. like any chord", () => {
    expect(timelineOf("[Am] [F] [N.C.]").totalBars).toBe(3);
  });

  it("is empty for a sheet with nothing to play", () => {
    expect(timelineOf("{title: X}\n\n").steps).toEqual([]);
  });
});

describe("stepIndexAt", () => {
  const timeline = timelineOf("[C]a [F]b\nplain line\n[G]c");

  it("finds the step sounding at a bar, including inside a long step", () => {
    expect(stepIndexAt(timeline, 0)).toBe(0);
    expect(stepIndexAt(timeline, 1.5)).toBe(1);
    expect(stepIndexAt(timeline, 2)).toBe(2);
    expect(stepIndexAt(timeline, 3.9)).toBe(2);
    expect(stepIndexAt(timeline, 4)).toBe(3);
  });

  it("clamps before the start and ends after the last bar", () => {
    expect(stepIndexAt(timeline, -2)).toBe(0);
    expect(stepIndexAt(timeline, 5)).toBeNull();
    expect(stepIndexAt(buildScrollTimeline([]), 0)).toBeNull();
  });
});
