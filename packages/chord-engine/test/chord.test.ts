import { describe, expect, it } from "vitest";
import { formatChord, formatNote, parseChord } from "../src/index.js";

describe("parseChord", () => {
  it.each([
    "C", "Cm", "Cmin", "C-", "C7", "Cmaj7", "CM7", "CΔ7", "Cm7", "Cm7b5", "Cø7", "Cdim", "Cdim7", "C°7",
    "Caug", "C+", "C7#5", "Csus2", "Csus4", "C7sus4", "Cadd9", "Csus4add9", "C6", "C6/9", "C69",
    "C9", "C11", "C13", "C7b9", "C7#9", "C7(b9)", "C7(#11)", "C13(b9,#11)", "C7alt", "C5",
    "F#m7(b5)", "Bbmaj7/D", "D/F#", "Ebm", "G#m", "E7/G#",
  ])("accepts %s and formats it back unchanged", (symbol) => {
    const chord = parseChord(symbol);
    expect(chord).not.toBeNull();
    expect(chord && formatChord(chord)).toBe(symbol);
  });

  it.each(["H", "Hm", "Cxyz", "C7(b9", "C7)b9(", "c", "", "Cmajor7th"])("rejects %s", (symbol) => {
    expect(parseChord(symbol)).toBeNull();
  });

  it("separates root, suffix and bass", () => {
    const chord = parseChord("Bbmaj7/D");
    expect(chord && formatNote(chord.root)).toBe("Bb");
    expect(chord?.suffix).toBe("maj7");
    expect(chord?.bass && formatNote(chord.bass)).toBe("D");
  });

  it.each([
    ["C", "major"],
    ["Cmaj7", "major"],
    ["Am7", "minor"],
    ["C-7", "minor"],
    ["Bm7b5", "half-diminished"],
    ["Bø", "half-diminished"],
    ["Bdim7", "diminished"],
    ["Caug", "augmented"],
    ["Dsus4", "suspended"],
    ["E5", "power"],
  ])("%s is %s", (symbol, quality) => {
    expect(parseChord(symbol)?.quality).toBe(quality);
  });
});
