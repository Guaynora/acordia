import { describe, expect, it } from "vitest";
import { parseChordProSong, parseLyricsLine } from "../src/index";

describe("parseLyricsLine", () => {
  it("splits chords and lyrics into segments", () => {
    expect(parseLyricsLine("[G]Walking down the [D/F#]road")).toEqual([
      { chord: "G", text: "Walking down the " },
      { chord: "D/F#", text: "road" },
    ]);
  });

  it("keeps lyrics before the first chord", () => {
    expect(parseLyricsLine("Oh [C]yes")).toEqual([
      { chord: null, text: "Oh " },
      { chord: "C", text: "yes" },
    ]);
  });

  it("handles chord-only lines", () => {
    expect(parseLyricsLine("[G] [D]")).toEqual([
      { chord: "G", text: " " },
      { chord: "D", text: "" },
    ]);
  });
});

describe("parseChordProSong", () => {
  it("collects metadata and section structure", () => {
    const song = parseChordProSong(
      ["{t: Example}", "{key: G}", "{tempo: 92}", "# a comment", "", "{soc: Coro}", "[G]La la", "{eoc}", "{c: x2}"].join("\n"),
    );
    expect(song.metadata).toEqual({ title: "Example", key: "G", tempo: "92" });
    expect(song.lines).toEqual([
      { kind: "empty" },
      { kind: "section-start", section: "chorus", label: "Coro" },
      { kind: "lyrics", segments: [{ chord: "G", text: "La la" }] },
      { kind: "section-end", section: "chorus" },
      { kind: "comment", text: "x2" },
    ]);
  });
});
