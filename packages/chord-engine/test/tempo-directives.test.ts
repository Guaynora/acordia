import { describe, expect, it } from "vitest";
import {
  parseChordProSong,
  parseGroups,
  parseKey,
  parseRamp,
  parseTimeSignature,
  shapeKey,
  transposeChordPro,
  validateChordPro,
  validateTempoDirectives,
} from "../src/index";

const key = (text: string) => {
  const parsed = parseKey(text);
  if (!parsed) throw new Error(`bad key ${text}`);
  return parsed;
};

const MODULATING = `{key: G}
{start_of_verse}
[G]Verse in [C]G with [D/F#]bass
{end_of_verse}
{start_of_chorus}
{key: Ab}
[Ab]Last chorus [Db]half a step [Eb7]up
{end_of_chorus}`;

describe("transposing a song that modulates", () => {
  it("moves the modulated part by the same interval, spelled in its own key (RFC: G->Ab, to F->Gb)", () => {
    const { text, errors } = transposeChordPro(MODULATING, key("G"), key("F"));
    expect(errors).toEqual([]);
    expect(text).toContain("{key: F}\n{start_of_verse}");
    expect(text).toContain("[F]Verse in [Bb]G with [C/E]bass");
    expect(text).toContain("{key: Gb}");
    expect(text).toContain("[Gb]Last chorus [Cb]half a step [Db7]up");
  });

  it("leaves a song untouched when transposing to its own key", () => {
    expect(transposeChordPro(MODULATING, key("G"), key("G")).text).toBe(MODULATING);
  });

  it("respells a modulation that would land on an unwritten key", () => {
    // C -> C#: a chorus in E would land on E#, which nobody writes; it becomes F.
    const source = "{key: C}\n[C]one\n{key: E}\n[E]two [B7]three";
    const { text } = transposeChordPro(source, key("C"), key("C#"));
    expect(text).toContain("{key: F}");
    expect(text).toContain("[F]two [C7]three");
  });

  it("follows a modulation with a capo too", () => {
    // Sounding in A (from G); capo 2 means G shapes for the verse and Ab -> Bb -> Ab shapes.
    const sounding = key("A");
    const { text } = transposeChordPro(MODULATING, key("G"), shapeKey(sounding, 2));
    expect(text).toContain("[G]Verse in [C]G");
    expect(text).toContain("{key: Ab}");
  });

  it("validates chords inside a modulated part in that part's key", () => {
    const source = "{key: G}\n[G]one\n{key: Ab}\n[Ab]two [Xyz]three";
    expect(validateChordPro(source, key("G")).map((e) => e.symbol)).toEqual(["Xyz"]);
  });
});

describe("change directives in the parser", () => {
  it("emits a change line where each directive applies and keeps the first value as metadata", () => {
    const song = parseChordProSong("{tempo: 92}\n[G]one\n{start_of_bridge}\n{time: 7/8}\n{x_groups: 2+2+3}\n{tempo: 140}\n[Em]two");
    expect(song.metadata["tempo"]).toBe("92");
    expect(song.metadata["time"]).toBe("7/8");
    expect(song.lines.filter((l) => l.kind === "change")).toEqual([
      { kind: "change", directive: "tempo", value: "92" },
      { kind: "change", directive: "time", value: "7/8" },
      { kind: "change", directive: "x_groups", value: "2+2+3" },
      { kind: "change", directive: "tempo", value: "140" },
    ]);
  });
});

describe("change directive values", () => {
  it("parses meters, groups and ramps", () => {
    expect(parseTimeSignature("7/8")).toEqual({ beats: 7, unit: 8 });
    expect(parseTimeSignature("7/7")).toBeNull();
    expect(parseGroups("2 + 2 + 3")).toEqual([2, 2, 3]);
    expect(parseGroups("7")).toBeNull();
    expect(parseRamp("140-120 4")).toEqual({ from: 140, to: 120, bars: 4 });
    expect(parseRamp("140 4")).toBeNull();
  });
});

describe("validateTempoDirectives", () => {
  const limits = { minBpm: 30, maxBpm: 300, initialTime: "4/4" };
  const problems = (source: string) => validateTempoDirectives(source, limits).map((e) => [e.line, e.problem]);

  it("accepts well-formed changes", () => {
    expect(problems("{tempo: 140}\n{time: 7/8}\n{x_groups: 2+2+3}\n{x_ramp: 140-120 4}\n{key: Ab}")).toEqual([]);
  });

  it("reports each kind of mistake with its line", () => {
    expect(
      problems("{tempo: fast}\n{tempo: 500}\n{time: 7/7}\n{x_groups: 2+x}\n{x_ramp: 140 to 120}\n{key: H}"),
    ).toEqual([
      [1, "invalid_tempo"],
      [2, "tempo_out_of_range"],
      [3, "invalid_time"],
      [4, "invalid_groups"],
      [5, "invalid_ramp"],
      [6, "invalid_key"],
    ]);
  });

  it("checks groups against the meter in force", () => {
    expect(problems("{x_groups: 2+2+3}")).toEqual([[1, "groups_mismatch"]]);
    expect(problems("{time: 7/8}\n{x_groups: 2+2}")).toEqual([[2, "groups_mismatch"]]);
    expect(problems("{time: 7/8}\n{x_groups: 3+2+2}")).toEqual([]);
  });
});
