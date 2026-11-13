import { describe, expect, it } from "vitest";
import {
  formatKey,
  importChordsOverLyrics,
  parseKey,
  readKey,
  suggestCapos,
  transposeChordPro,
  validateChordPro,
} from "../src/index";

const SONG = `{title: Example}
{key: G}
{tempo: 92}

{start_of_verse}
[G]Walking down the [D/F#]road
[Em7]Under a [Cadd9]silver sky [*riff]
{end_of_verse}`;

describe("ChordPro", () => {
  it("reads the key directive", () => {
    const key = readKey(SONG);
    expect(key && formatKey(key)).toBe("G");
  });

  it("transposes every chord and the key directive", () => {
    const from = parseKey("G");
    const to = parseKey("F");
    if (!from || !to) throw new Error("bad keys");
    const result = transposeChordPro(SONG, from, to);
    expect(result.errors).toEqual([]);
    expect(result.text).toContain("{key: F}");
    expect(result.text).toContain("[F]Walking down the [C/E]road");
    expect(result.text).toContain("[Dm7]Under a [Bbadd9]silver sky [*riff]");
    expect(result.text).toContain("{tempo: 92}");
  });

  it("reports the position of unknown chords", () => {
    const key = parseKey("C");
    if (!key) throw new Error("bad key");
    const errors = validateChordPro("[C]one\ntwo [Hm7]three", key);
    expect(errors).toEqual([
      { line: 2, column: 5, symbol: "Hm7", message: 'Unrecognized chord: "Hm7"' },
    ]);
  });
});

describe("importChordsOverLyrics", () => {
  it("merges chord lines into the lyric line below at the same columns", () => {
    const text = ["Intro:", "G   D   Em  C", "", "[Verso]", "G         D/F#", "Walking down the road"].join("\n");
    const result = importChordsOverLyrics(text);
    expect(result.errors).toEqual([]);
    expect(result.chordpro).toBe(
      [
        "{comment: Intro}",
        "[G] [D] [Em] [C]",
        "",
        "{start_of_verse: Verso}",
        "[G]Walking do[D/F#]wn the road",
        "{end_of_verse}",
      ].join("\n"),
    );
  });

  it("turns known section names into ChordPro blocks", () => {
    const text = ["Estrofa:", "C", "Uno", "", "[Coro]", "G", "Dos", "", "Solo:", "C  G"].join("\n");
    expect(importChordsOverLyrics(text).chordpro).toBe(
      [
        "{start_of_verse: Estrofa}",
        "[C]Uno",
        "{end_of_verse}",
        "",
        "{start_of_chorus: Coro}",
        "[G]Dos",
        "{end_of_chorus}",
        "",
        "{comment: Solo}",
        "[C] [G]",
      ].join("\n"),
    );
  });

  it("pads lyrics shorter than their chord line", () => {
    const result = importChordsOverLyrics("C       G\nHola");
    expect(result.chordpro).toBe("[C]Hola    [G]");
  });

  it("flags unknown tokens on a chord line", () => {
    const result = importChordsOverLyrics("C  Hm  G  D\nla la la la");
    expect(result.errors.map((e) => e.symbol)).toEqual(["Hm"]);
  });

  it("leaves plain lyric lines alone", () => {
    const result = importChordsOverLyrics("A veces la vida\nes una canción");
    expect(result.chordpro).toBe("A veces la vida\nes una canción");
  });
});

describe("suggestCapos", () => {
  it("suggests open shapes for a song in Eb", () => {
    const key = parseKey("Eb");
    if (!key) throw new Error("bad key");
    const options = suggestCapos(key).map((o) => `${o.fret}:${formatKey(o.shapes)}`);
    expect(options).toEqual(["1:D", "3:C", "6:A"]);
  });
});
