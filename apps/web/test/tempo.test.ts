import { describe, expect, it } from "vitest";
import { tempoMarking } from "@/domain/tempo";

describe("tempoMarking", () => {
  it.each([
    [40, "largo"],
    [60, "adagio"],
    [90, "andante"],
    [110, "moderato"],
    [120, "allegro"],
    [180, "presto"],
  ] as const)("%d BPM is %s", (bpm, marking) => {
    expect(tempoMarking(bpm)).toBe(marking);
  });
});
