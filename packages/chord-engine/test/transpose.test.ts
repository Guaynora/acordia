import { describe, expect, it } from "vitest";
import { type Key, formatKey, parseKey, transposeKey, transposeSymbol } from "../src/index.js";

function key(text: string): Key {
  const parsed = parseKey(text);
  if (!parsed) throw new Error(`Bad key in test: ${text}`);
  return parsed;
}

function transpose(symbol: string, from: string, to: string): string {
  const result = transposeSymbol(symbol, key(from), key(to));
  if (!result.ok) throw new Error(result.error);
  return result.text;
}

describe("RFC acceptance cases", () => {
  it.each([
    ["C", "F", "Bb", "Eb"],
    ["G", "F", "F", "Eb"],
    ["G", "F", "D/F#", "C/E"],
    ["C", "Eb", "F#m7b5", "Am7b5"],
    ["D", "Bb", "A7sus4", "F7sus4"],
    ["E", "Db", "G#m", "Fm"],
    ["A", "Ab", "C#7(b9)", "C7(b9)"],
    ["Am", "Gm", "E7/G#", "D7/F#"],
  ])("%s -> %s: %s becomes %s", (from, to, input, expected) => {
    expect(transpose(input, from, to)).toBe(expected);
  });
});

describe("spelling follows the target key", () => {
  it("uses flats in flat keys and sharps in sharp keys", () => {
    expect(transpose("A#", "E", "F")).toBe("B");
    expect(transpose("Bb", "C", "D")).toBe("C");
    expect(transpose("F", "C", "D")).toBe("G");
    expect(transpose("F#", "G", "Bb")).toBe("A");
    expect(transpose("C#m", "A", "Bb")).toBe("Dm");
  });

  it("keeps Cb when the key really uses it", () => {
    expect(transpose("Gb", "Db", "Gb")).toBe("Cb");
  });

  it("simplifies awkward chromatic spellings", () => {
    // G#dim in C is a passing chord; in E it would be B#dim, shown as Cdim.
    expect(transpose("G#dim", "C", "E")).toBe("Cdim");
  });

  it("moves the slash bass together with the root", () => {
    expect(transpose("C/G", "C", "Eb")).toBe("Eb/Bb");
    expect(transpose("Bbmaj7/D", "F", "G")).toBe("Cmaj7/E");
  });

  it("preserves the suffix exactly as written", () => {
    expect(transpose("Cmaj7#11", "C", "D")).toBe("Dmaj7#11");
    expect(transpose("Csus4add9", "C", "A")).toBe("Asus4add9");
    expect(transpose("C6/9", "C", "Bb")).toBe("Bb6/9");
    expect(transpose("C-7", "C", "G")).toBe("G-7");
  });

  it("passes non-chord markers through", () => {
    expect(transpose("N.C.", "C", "D")).toBe("N.C.");
    expect(transpose("%", "C", "D")).toBe("%");
  });

  it("reports unknown chords instead of skipping them", () => {
    const result = transposeSymbol("Cxyz", key("C"), key("D"));
    expect(result.ok).toBe(false);
  });
});

describe("choosing a key when stepping by semitones", () => {
  it.each([
    ["C", 1, "Db"],
    ["A", 1, "Bb"],
    ["G", -1, "F#"],
    ["E", 1, "F"],
    ["B", 1, "C"],
    ["Am", 1, "Bbm"],
    ["Em", 1, "Fm"],
    ["Bbm", 1, "Bm"],
  ] as const)("%s %+d -> %s", (from, steps, expected) => {
    expect(formatKey(transposeKey(key(from), steps))).toBe(expected);
  });

  it("resolves the F#/Gb tie by preference", () => {
    expect(formatKey(transposeKey(key("F"), 1, "sharp"))).toBe("F#");
    expect(formatKey(transposeKey(key("F"), 1, "flat"))).toBe("Gb");
  });

  it("round-trips a full song through all twelve keys", () => {
    const song = ["G", "D/F#", "Em7", "Cadd9", "Am7", "D7sus4", "Bm", "Bb", "F#m7b5"];
    let current = key("G");
    let chords = song;
    for (let step = 0; step < 12; step++) {
      const next = transposeKey(current, 1);
      chords = chords.map((c) => {
        const r = transposeSymbol(c, current, next);
        if (!r.ok) throw new Error(r.error);
        return r.text;
      });
      current = next;
    }
    expect(formatKey(current)).toBe("G");
    expect(chords).toEqual(song);
  });
});
