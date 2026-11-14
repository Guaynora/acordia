import { parseChordProSong } from "@acordia/chord-engine";
import { describe, expect, it } from "vitest";
import { buildScrollTimeline, lineBars, stepIndexAt } from "@/domain/scroll-timeline";

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

describe("bar lines", () => {
  const steps = (source: string) => timelineOf(source).steps.map((s) => [s.segment, s.startBar, s.bars]);

  it("shares a bar between the chords inside it", () => {
    // | G | C D | -> G one bar, C and D half a bar each.
    expect(steps("| [G]Walking | [C]down the [D]road |")).toEqual([
      [1, 0, 1],
      [2, 1, 0.5],
      [3, 1.5, 0.5],
    ]);
  });

  it("holds the previous chord through a bar without chords", () => {
    expect(steps("| [G]Long note | | [C]then |")).toEqual([
      [1, 0, 2],
      [2, 2, 1],
    ]);
    expect(timelineOf("| [G]Long note | | [C]then |").totalBars).toBe(3);
  });

  it("times a bar without chords at the start of a line as the line itself", () => {
    // The words before C are one segment, so C is segment 1.
    expect(steps("| sung on | [C]then |")).toEqual([
      [null, 0, 1],
      [1, 1, 1],
    ]);
  });

  it("treats words before the first bar line as a pickup, but chords there as a bar", () => {
    expect(steps("And | [G]then |")).toEqual([[1, 0, 1]]);
    expect(steps("[Em]Intro | [G]then")).toEqual([
      [0, 0, 1],
      [1, 1, 1],
    ]);
  });

  it("counts chord-only bars, including three chords in one bar", () => {
    const timeline = timelineOf("| [G] [C] [D] | [G] |");
    expect(timeline.steps.map((s) => s.bars)).toEqual([1 / 3, 1 / 3, 1 / 3, 1]);
    expect(timeline.totalBars).toBe(2);
    // Two thirds into the first bar, D sounds.
    expect(stepIndexAt(timeline, 2 / 3)).toBe(2);
  });

  it("mixes measured and unmeasured lines", () => {
    const timeline = timelineOf("[G]one [C]two\n| [D]half [G]half |\nplain line");
    expect(timeline.steps.map((s) => s.startBar)).toEqual([0, 1, 2, 2.5, 3]);
    expect(timeline.totalBars).toBe(5);
  });
});

describe("played order", () => {
  it("times repeated lines again, pointing at the same written lines", () => {
    const timeline = timelineOf("[G]intro\n|: [C]one\n[D]two :|\n[G]end");
    expect(timeline.steps.map((s) => [s.line, s.startBar])).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [1, 3],
      [2, 4],
      [3, 5],
    ]);
  });

  it("counts |: and :| as bar lines, and || as one", () => {
    expect(timelineOf("|: [G] | [C] [D] :|").steps.map((s) => s.bars)).toEqual([1, 0.5, 0.5, 1, 0.5, 0.5]);
    expect(timelineOf("| [G] || [C] |").totalBars).toBe(2);
  });

  it("marks where each change is reached, once per pass", () => {
    const repeated = timelineOf("[G]a\n{start_of_chorus: Coro x2}\n{tempo: 140}\n[C]b\n{end_of_chorus}");
    expect(repeated.marks).toEqual([
      { line: 2, bar: 1 },
      { line: 2, bar: 2 },
    ]);
  });
});

describe("lineBars", () => {
  const bars = (source: string) => {
    const line = parseChordProSong(source).lines[0];
    return line ? lineBars(line) : [];
  };

  it("gives one bar per chord without bar lines, and two held bars to a line without chords", () => {
    expect(bars("And [G]one [C]two")).toEqual([[1], [2]]);
    expect(bars("only words")).toEqual([[], []]);
  });

  it("follows bar lines: shared bars, held bars and a pickup", () => {
    expect(bars("And | [G]one | [C]two [D]three | |")).toEqual([[1], [2, 3], []]);
  });

  it("has no bars for a line with nothing to play", () => {
    expect(bars("   ")).toEqual([]);
  });
});
