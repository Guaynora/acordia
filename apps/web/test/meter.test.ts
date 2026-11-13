import { describe, expect, it } from "vitest";
import { METERS, meterFor, secondsPerClick } from "@/domain/meter";

describe("meters", () => {
  it("has one click per eighth in 6/8 and counts BPM in dotted quarters", () => {
    const meter = meterFor("6/8");
    expect(meter.accents).toHaveLength(6);
    // 60 BPM dotted quarter = 3 eighth clicks per second.
    expect(secondsPerClick(meter, 60)).toBeCloseTo(1 / 3);
  });

  it("groups 7/8 as 2+2+3", () => {
    expect(meterFor("7/8").accents).toEqual([0, 2, 1, 2, 1, 2, 2]);
  });

  it("counts quarter notes in simple meters", () => {
    expect(secondsPerClick(meterFor("3/4"), 120)).toBeCloseTo(0.5);
  });

  it("falls back to 4/4 for unknown signatures", () => {
    expect(meterFor("9/16").signature).toBe("4/4");
  });

  it("starts every bar on a downbeat", () => {
    for (const meter of METERS) expect(meter.accents[0]).toBe(0);
  });
});
