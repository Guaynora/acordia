import { describe, expect, it } from "vitest";
import { BASS_TUNING, chordTones, fretPositions, parseChord, parseNote, pianoVoicing, formatNote } from "../src";

function tones(symbol: string) {
  const chord = parseChord(symbol);
  if (!chord) throw new Error(`Cannot parse ${symbol}`);
  const result = chordTones(chord);
  if (!result) throw new Error(`No tones for ${symbol}`);
  return result;
}

const notes = (symbol: string) => tones(symbol).tones.map((t) => formatNote(t.note)).join(" ");
const degrees = (symbol: string) => tones(symbol).tones.map((t) => t.degree).join(" ");

describe("chordTones", () => {
  it.each([
    ["C", "C E G"],
    ["Am", "A C E"],
    ["F7", "F A C Eb"],
    ["Bbmaj7", "Bb D F A"],
    ["F#m7b5", "F# A C E"],
    ["Bm7(b5)", "B D F A"],
    ["Cdim7", "C Eb Gb Bbb"],
    ["C°", "C Eb Gb"],
    ["Caug", "C E G#"],
    ["Dsus4", "D G A"],
    ["Dsus2", "D E A"],
    ["A7sus4", "A D E G"],
    ["C6", "C E G A"],
    ["C6/9", "C E G A D"],
    ["Cadd9", "C E G D"],
    ["C9", "C E G Bb D"],
    ["Cm9", "C Eb G Bb D"],
    ["Cmaj9", "C E G B D"],
    ["C11", "C G Bb D F"],
    ["Cm11", "C Eb G Bb D F"],
    ["C13", "C E G Bb D A"],
    ["C7(b9)", "C E G Bb Db"],
    ["C7#9", "C E G Bb D#"],
    ["C7#11", "C E G Bb F#"],
    ["C7alt", "C E Bb Db D# Ab"],
    ["E5", "E B"],
    ["CΔ", "C E G B"],
  ])("%s → %s", (symbol, expected) => {
    expect(notes(symbol)).toBe(expected);
  });

  it("names degrees the way musicians read them", () => {
    expect(degrees("F#m7b5")).toBe("1 b3 b5 b7");
    expect(degrees("C7(b9)")).toBe("1 3 5 b7 b9");
  });

  it("spells notes from the chord's own root, so keys with flats stay flat", () => {
    expect(notes("Eb7")).toBe("Eb G Bb Db");
    expect(notes("Db")).toBe("Db F Ab");
    expect(notes("C#")).toBe("C# E# G#");
  });

  it("uses the slash note as the bass", () => {
    const result = tones("D/F#");
    expect(formatNote(result.bass)).toBe("F#");
    expect(notes("D/F#")).toBe("D F# A");
    expect(formatNote(tones("G").bass)).toBe("G");
  });
});

describe("pianoVoicing", () => {
  it("puts the bass below middle C and the chord close around it", () => {
    const voicing = pianoVoicing(tones("C"));
    expect(voicing.left).toBe(48); // C3
    expect(voicing.right).toEqual([60, 64, 67]); // C4 E4 G4
  });

  it("plays the slash bass with the left hand", () => {
    expect(pianoVoicing(tones("D/F#")).left).toBe(54); // F#3
  });

  it("keeps the left hand clearly below the right hand", () => {
    for (const symbol of ["Bbmaj7", "B", "A7", "C", "Ab/C"]) {
      const { left, right } = pianoVoicing(tones(symbol));
      expect(left).toBeLessThanOrEqual((right[0] ?? 0) - 3);
    }
    expect(pianoVoicing(tones("Bbmaj7")).left).toBe(46); // Bb2
  });

  it("keeps the right hand ascending and within reach", () => {
    for (const symbol of ["G", "Bbmaj7", "F#m7b5", "C13", "Ab"]) {
      const { right } = pianoVoicing(tones(symbol));
      expect([...right].sort((a, b) => a - b)).toEqual(right);
      expect(right[0]).toBeGreaterThanOrEqual(57);
      expect((right.at(-1) ?? 0) - (right[0] ?? 0)).toBeLessThanOrEqual(24);
    }
  });
});

describe("fretPositions", () => {
  it("finds every place a note sits on a bass, open strings included", () => {
    const e = parseNote("E");
    if (!e) throw new Error("unreachable");
    expect(fretPositions(e, BASS_TUNING, 12)).toEqual([
      { string: 0, fret: 0 },
      { string: 0, fret: 12 },
      { string: 1, fret: 7 },
      { string: 2, fret: 2 },
      { string: 3, fret: 9 },
    ]);
  });
});
