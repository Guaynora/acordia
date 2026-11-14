import { describe, expect, it } from "vitest";
import { chordDegree, formatDegree, formatKey, keysByLine, parseChordProSong, parseKey } from "../src/index";

const key = (text: string) => {
  const parsed = parseKey(text);
  if (!parsed) throw new Error(`bad key ${text}`);
  return parsed;
};
const degree = (symbol: string, inKey: string) => {
  const result = chordDegree(symbol, key(inKey));
  return result && formatDegree(result);
};

describe("chordDegree", () => {
  it("numbers the diatonic chords of a major key", () => {
    expect(["G", "Am", "Bm", "C", "D7", "Em", "F#m7b5"].map((c) => degree(c, "G"))).toEqual([
      "1",
      "2m",
      "3m",
      "4",
      "57",
      "6m",
      "7m7b5",
    ]);
  });

  it("keeps the suffix apart, so 5 with a seventh is not read as fifty-seven", () => {
    expect(chordDegree("D7", key("G"))).toEqual({ degree: "5", suffix: "7", bass: null });
  });

  it("marks notes outside the scale with their accidental", () => {
    expect(degree("Bb", "C")).toBe("b7");
    expect(degree("Eb", "C")).toBe("b3");
    expect(degree("F#dim", "C")).toBe("#4dim");
    expect(degree("Ab", "C")).toBe("b6");
  });

  it("works in keys full of sharps or flats", () => {
    expect(degree("C#m", "E")).toBe("6m");
    expect(degree("Db", "Ab")).toBe("4");
    expect(degree("Cb", "Gb")).toBe("4");
  });

  it("numbers a minor key from its own tonic", () => {
    expect(["Am", "Dm", "E7", "F", "G", "C"].map((c) => degree(c, "Am"))).toEqual(["1m", "4m", "57", "6", "7", "3"]);
  });

  it("numbers the bass of a slash chord", () => {
    expect(degree("D/F#", "G")).toBe("5/7");
    expect(degree("C/E", "C")).toBe("1/3");
  });

  it("leaves markers as written and rejects what does not parse", () => {
    expect(degree("N.C.", "G")).toBe("N.C.");
    expect(degree("Xyz", "G")).toBeNull();
  });
});

describe("keysByLine", () => {
  it("follows modulations written after the music starts", () => {
    const song = parseChordProSong("{key: G}\n[G]one\n{key: Ab}\n[Ab]two");
    expect(keysByLine(song.lines, key("G")).map(formatKey)).toEqual(["G", "G", "Ab", "Ab"]);
  });

  it("takes a {key} before the music as the song's own", () => {
    const song = parseChordProSong("{key: C}\n[G]one");
    expect(keysByLine(song.lines, key("G")).map(formatKey)).toEqual(["G", "G"]);
  });
});
