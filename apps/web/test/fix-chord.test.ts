import { describe, expect, it } from "vitest";
import { replaceChord } from "@/application/fix-chord";

describe("replaceChord", () => {
  it("fixes plain chord lines and keeps later chords aligned", () => {
    const source = ["Lam     Sol     Do", "La luz de la mañana"].join("\n");
    expect(replaceChord(source, "Lam", "Am", [1])).toBe(["Am      Sol     Do", "La luz de la mañana"].join("\n"));
  });

  it("never touches lyric lines", () => {
    const source = ["Lam", "Lam es una palabra"].join("\n");
    expect(replaceChord(source, "Lam", "Am", [1])).toBe(["Am", "Lam es una palabra"].join("\n"));
  });

  it("replaces only bracketed chords in ChordPro", () => {
    expect(replaceChord("[C]Hola [Hm]Hm", "Hm", "Bm", [1])).toBe("[C]Hola [Bm]Hm");
  });
});
