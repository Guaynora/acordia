import { describe, expect, it } from "vitest";
import { importChordsOverLyrics, suggestChord } from "../src/index";

describe("suggestChord", () => {
  it.each([
    ["Hm", "Bm"],
    ["H7", "B7"],
    ["Lam", "Am"],
    ["Sol7", "G7"],
    ["Fa#m", "F#m"],
    ["Sibmaj7", "Bbmaj7"],
    ["Do/Mi", "C/E"],
    ["Re/Fa#", "D/F#"],
    ["G7.", "G7"],
  ])("%s -> %s", (input, expected) => {
    expect(suggestChord(input)).toBe(expected);
  });

  it.each(["G", "la", "mi", "amor", "Xyz"])("has no suggestion for %s", (input) => {
    expect(suggestChord(input)).toBeNull();
  });
});

describe("importing charts in other notations", () => {
  it("treats a line of Latin chords as chords and offers fixes", () => {
    const result = importChordsOverLyrics("Do      Sol\nMi corazón late");
    expect(result.errors.map((e) => [e.symbol, e.suggestion])).toEqual([
      ["Do", "C"],
      ["Sol", "G"],
    ]);
  });

  it("keeps Spanish lyrics that start with a solfège word as lyrics", () => {
    const result = importChordsOverLyrics("C\nMi amor");
    expect(result.errors).toEqual([]);
    expect(result.chordpro).toBe("[C]Mi amor");
  });
});
