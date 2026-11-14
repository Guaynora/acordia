import { describe, expect, it } from "vitest";
import { parseChordProSong, parseEndingNumbers, performanceOrder, validateStructure } from "../src/index";

/** The lyric lines of a song, in the order they are played, without chords or bar lines. */
function played(source: string): string[] {
  const song = parseChordProSong(source);
  return performanceOrder(song.lines).flatMap((index) => {
    const line = song.lines[index];
    if (line?.kind !== "lyrics") return [];
    return [line.segments.map((s) => s.text).join("").replace(/:\|\s*\(?x\d+\)?|[|:]/g, "").trim()];
  });
}

describe("performanceOrder", () => {
  it("plays a song without repeats as written", () => {
    expect(played("[G]one\n[C]two\n[D]three")).toEqual(["one", "two", "three"]);
  });

  it("repeats the lines between |: and :|", () => {
    expect(played("[G]intro\n|: [G]one\n[C]two :|\n[D]end")).toEqual(["intro", "one", "two", "one", "two", "end"]);
  });

  it("repeats as many times as :|x3 says", () => {
    expect(played("|: [G]one :|x3\n[D]end")).toEqual(["one", "one", "one", "end"]);
    expect(played("|: [G]one :| (x3)\n[D]end")).toEqual(["one", "one", "one", "end"]);
  });

  it("repeats from the start of the section when there is no |:", () => {
    const source = "[G]intro\n{start_of_chorus}\n[C]one\n[D]two :|\n{end_of_chorus}\n[G]end";
    expect(played(source)).toEqual(["intro", "one", "two", "one", "two", "end"]);
  });

  it("plays first and second endings", () => {
    const source = "|: [G]one\n{x_ending: 1}\n[C]first :|\n{x_ending: 2}\n[D]second\n[G]end";
    expect(played(source)).toEqual(["one", "first", "one", "second", "end"]);
  });

  it("plays an ending shared by several passes", () => {
    const source = "|: [G]one\n{x_ending: 1,2}\n[C]first :|x3\n{x_ending: 3}\n[D]third";
    expect(played(source)).toEqual(["one", "first", "one", "first", "one", "third"]);
  });

  it("plays a whole section marked x2", () => {
    const source = "{start_of_chorus: Coro x2}\n[C]one\n[D]two\n{end_of_chorus}\n[G]end";
    expect(played(source)).toEqual(["one", "two", "one", "two", "end"]);
    expect(played("{c: Intro (x2)}\n[G]riff\n{c: Verse}\n[C]words")).toEqual(["riff", "riff", "words"]);
  });

  it("does not take a bare 'x2' comment for a section", () => {
    expect(played("[G]one\n{c: x2}\n[C]two")).toEqual(["one", "two"]);
  });

  it("goes back to the segno on D.S. al Coda and jumps to the coda", () => {
    const source = [
      "[G]intro",
      "{x_segno}",
      "[C]verse",
      "{x_to_coda}",
      "[D]bridge",
      "{x_ds_al_coda}",
      "{x_coda}",
      "[G]coda",
    ].join("\n");
    expect(played(source)).toEqual(["intro", "verse", "bridge", "verse", "coda"]);
  });

  it("goes back to the top on D.C. al Fine and stops at the fine", () => {
    const source = "[G]one\n[C]two\n{x_fine}\n[D]three\n{x_dc_al_fine}";
    expect(played(source)).toEqual(["one", "two", "three", "one", "two"]);
  });

  it("plays repeats once and takes the last ending after a D.S.", () => {
    const source = [
      "{x_segno}",
      "|: [G]one",
      "{x_ending: 1}",
      "[C]first :|",
      "{x_ending: 2}",
      "[D]second",
      "{x_to_coda}",
      "[E]bridge",
      "{x_ds_al_coda}",
      "{x_coda}",
      "[G]coda",
    ].join("\n");
    expect(played(source)).toEqual(["one", "first", "one", "second", "bridge", "one", "second", "coda"]);
  });

  it("repeats a single line holding both signs", () => {
    expect(played("|: [G] | [C] :|\n[D]end")).toEqual(["", "", "end"]);
  });

  it("nests a line repeat inside a section repeat", () => {
    const source = "{start_of_chorus: Coro x2}\n|: [C]hey :|\n[D]ho\n{end_of_chorus}";
    expect(played(source)).toEqual(["hey", "hey", "ho", "hey", "hey", "ho"]);
  });
});

describe("parseEndingNumbers", () => {
  it("reads the usual ways of writing endings", () => {
    expect(parseEndingNumbers("1")).toEqual([1]);
    expect(parseEndingNumbers("2.")).toEqual([2]);
    expect(parseEndingNumbers("1,2")).toEqual([1, 2]);
    expect(parseEndingNumbers("1-3")).toEqual([1, 2, 3]);
    expect(parseEndingNumbers("first")).toBeNull();
    expect(parseEndingNumbers("0")).toBeNull();
  });
});

describe("validateStructure", () => {
  const problems = (source: string) => validateStructure(source).map((e) => [e.line, e.problem]);

  it("accepts well-formed repeats, endings and jumps", () => {
    expect(
      problems("{x_segno}\n|: [G]one\n{x_ending: 1}\n[C]a :|\n{x_ending: 2}\n[D]b\n{x_to_coda}\n{x_ds_al_coda}\n{x_coda}\n[G]c"),
    ).toEqual([]);
  });

  it("reports what cannot be followed", () => {
    expect(problems("|: [G]one :|x1")).toEqual([[1, "invalid_repeat_count"]]);
    expect(problems("{x_ending: first}\n[G]a :|")).toEqual([[1, "invalid_ending"]]);
    expect(problems("{x_ending: 1}\n[G]a")).toEqual([[1, "ending_outside_repeat"]]);
    expect(problems("[G]a\n{x_ds_al_coda}")).toEqual([
      [2, "missing_segno"],
      [2, "missing_coda"],
    ]);
    expect(problems("[G]a\n{x_dc_al_fine}")).toEqual([[2, "missing_fine"]]);
  });
});
