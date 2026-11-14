import { describe, expect, it } from "vitest";
import {
  GUITAR_TUNING,
  UKULELE_TUNING,
  chordTones,
  formatNote,
  generateShapes,
  parseChord,
  shapeMatches,
  shapeMidi,
  simplestSpelling,
} from "../src";

function tones(symbol: string) {
  const result = chordTones(parseChord(symbol)!);
  if (!result) throw new Error(symbol);
  return result;
}

const guitar = (frets: number[]) => ({ frets });

describe("shapeMatches", () => {
  it("accepts the classic open shapes", () => {
    expect(shapeMatches(guitar([-1, 3, 2, 0, 1, 0]), tones("C"), GUITAR_TUNING, true)).toBe(true);
    expect(shapeMatches(guitar([3, 2, 0, 0, 0, 3]), tones("G"), GUITAR_TUNING, true)).toBe(true);
    expect(shapeMatches(guitar([-1, 0, 2, 2, 1, 0]), tones("Am"), GUITAR_TUNING, true)).toBe(true);
    expect(shapeMatches(guitar([-1, 3, 2, 3, 1, 0]), tones("C7"), GUITAR_TUNING, true)).toBe(true);
  });

  it("rejects a shape for the wrong chord", () => {
    expect(shapeMatches(guitar([-1, 3, 2, 0, 1, 0]), tones("Cm"), GUITAR_TUNING, true)).toBe(false);
    expect(shapeMatches(guitar([-1, 3, 2, 0, 1, 0]), tones("C7"), GUITAR_TUNING, true)).toBe(false);
  });

  it("lets the plain fifth go but not the seventh", () => {
    // C7 without its fifth: x3231x
    expect(shapeMatches(guitar([-1, 3, 2, 3, 1, -1]), tones("C7"), GUITAR_TUNING, true)).toBe(true);
  });

  it("requires the slash bass as the lowest note", () => {
    const dOverFSharp = guitar([2, 0, 0, 2, 3, 2]);
    expect(shapeMatches(dOverFSharp, tones("D/F#"), GUITAR_TUNING, true)).toBe(true);
    expect(shapeMatches(guitar([-1, -1, 0, 2, 3, 2]), tones("D/F#"), GUITAR_TUNING, true)).toBe(false);
  });

  it("reads re-entrant ukulele tuning correctly", () => {
    const c = { frets: [0, 0, 0, 3] };
    expect(shapeMidi(c, UKULELE_TUNING).map((m) => formatNote(simplestSpelling(m, "sharp")))).toEqual(["G", "C", "E", "C"]);
    expect(shapeMatches(c, tones("C"), UKULELE_TUNING, false)).toBe(true);
  });
});

describe("generateShapes", () => {
  it.each(["F#m7b5", "C7#9", "Bbmaj7", "D/F#", "Ebdim7", "Asus2", "G13"])("finds playable guitar shapes for %s", (symbol) => {
    const chord = tones(symbol);
    const shapes = generateShapes(chord, GUITAR_TUNING, { checkBass: true });
    expect(shapes.length).toBeGreaterThan(0);
    for (const shape of shapes) {
      expect(shapeMatches(shape, chord, GUITAR_TUNING, true)).toBe(true);
      const fretted = shape.frets.filter((f) => f > 0);
      if (fretted.length > 0) expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThan(4);
    }
  });

  it("finds ukulele shapes too", () => {
    const shapes = generateShapes(tones("Fmaj7"), UKULELE_TUNING, { checkBass: false });
    expect(shapes.length).toBeGreaterThan(0);
  });
});
