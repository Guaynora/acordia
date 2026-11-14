import { describe, expect, it } from "vitest";
import { METERS, barSteps, countInClicks, meterFor, secondsPerClick, secondsPerStep, subdivisionsFor } from "@/domain/meter";

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

describe("subdivisions", () => {
  it("offers triplets and sixteenths only where they make sense", () => {
    expect(subdivisionsFor(meterFor("4/4"))).toEqual([1, 2, 3, 4]);
    expect(subdivisionsFor(meterFor("7/8"))).toEqual([1, 2, 3, 4]);
    expect(subdivisionsFor(meterFor("6/8"))).toEqual([1, 2]);
  });

  it("splits each click into softer ticks that keep the bar position", () => {
    const steps = barSteps(meterFor("3/4"), 2);
    expect(steps).toEqual([
      { click: 0, sub: 0, accent: 0 },
      { click: 0, sub: 1, accent: "sub" },
      { click: 1, sub: 0, accent: 2 },
      { click: 1, sub: 1, accent: "sub" },
      { click: 2, sub: 0, accent: 2 },
      { click: 2, sub: 1, accent: "sub" },
    ]);
    expect(barSteps(meterFor("4/4"), 1)).toHaveLength(4);
    expect(barSteps(meterFor("4/4"), 3)).toHaveLength(12);
  });

  it("keeps the beat at the same speed whatever the subdivision", () => {
    const meter = meterFor("4/4");
    expect(secondsPerStep(meter, 120, 1)).toBeCloseTo(0.5);
    expect(secondsPerStep(meter, 120, 2)).toBeCloseTo(0.25);
    expect(secondsPerStep(meter, 120, 3)).toBeCloseTo(1 / 6);
    expect(secondsPerStep(meterFor("6/8"), 60, 2) * 2 * 3).toBeCloseTo(1);
  });

  it("counts in whole bars", () => {
    expect(countInClicks(meterFor("4/4"), 1)).toBe(4);
    expect(countInClicks(meterFor("6/8"), 2)).toBe(12);
    expect(countInClicks(meterFor("3/4"), 0)).toBe(0);
  });
});

describe("meters from song directives", () => {
  it("regroups the accents of an odd meter", () => {
    expect(meterFor("7/8", [3, 2, 2]).accents).toEqual([0, 2, 2, 1, 2, 1, 2]);
    expect(meterFor("7/8", [3, 2, 2]).groups).toEqual([3, 2, 2]);
  });

  it("ignores groups that do not fill the bar", () => {
    expect(meterFor("7/8", [2, 2]).accents).toEqual(meterFor("7/8").accents);
  });

  it("builds meters the picker does not list", () => {
    const nine = meterFor("9/8");
    expect(nine.kind).toBe("compound");
    expect(nine.accents).toEqual([0, 2, 2, 1, 2, 2, 1, 2, 2]);
    expect(meterFor("11/8").accents).toEqual([0, 2, 1, 2, 1, 2, 1, 2, 1, 2, 2]);
    expect(meterFor("3/8").accents).toEqual([0, 2, 2]);
    expect(meterFor("6/4").accents).toEqual([0, 2, 2, 2, 2, 2]);
  });
});
