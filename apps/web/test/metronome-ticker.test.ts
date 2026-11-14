import { describe, expect, it } from "vitest";
import { meterFor } from "@/domain/meter";
import { MetronomeTicker } from "@/domain/metronome-ticker";

const take = (ticker: MetronomeTicker, n: number, ...args: Parameters<MetronomeTicker["next"]>) =>
  Array.from({ length: n }, () => ticker.next(...args));

describe("MetronomeTicker", () => {
  const fourFour = meterFor("4/4");

  it("counts in one bar, then plays the bar with its subdivisions", () => {
    const ticker = new MetronomeTicker(fourFour, 1);
    const countIn = take(ticker, 4, fourFour, 2, 120);
    expect(countIn.map((t) => t.countdown)).toEqual([4, 3, 2, 1]);
    expect(countIn.every((t) => t.main && t.duration === 0.5)).toBe(true);

    const bar = take(ticker, 8, fourFour, 2, 120);
    expect(bar.map((t) => t.countdown)).toEqual(Array(8).fill(null));
    expect(bar.map((t) => t.accent)).toEqual([0, "sub", 2, "sub", 1, "sub", 2, "sub"]);
    expect(bar.map((t) => t.main)).toEqual([true, false, true, false, true, false, true, false]);
    expect(bar.every((t) => t.duration === 0.25)).toBe(true);
  });

  it("starts on the downbeat after the count-in", () => {
    const ticker = new MetronomeTicker(meterFor("3/4"), 2);
    take(ticker, 6, meterFor("3/4"), 1, 90);
    expect(ticker.next(meterFor("3/4"), 1, 90)).toMatchObject({ click: 0, accent: 0, countdown: null });
  });

  it("follows a subdivision change on the next beat", () => {
    const ticker = new MetronomeTicker(fourFour, 0);
    take(ticker, 3, fourFour, 3, 60); // one triplet beat
    const next = take(ticker, 2, fourFour, 1, 60);
    expect(next.map((t) => [t.click, t.main])).toEqual([
      [1, true],
      [2, true],
    ]);
  });

  it("keeps the beat when going from sixteenths to eighths mid-beat", () => {
    const ticker = new MetronomeTicker(fourFour, 0);
    take(ticker, 3, fourFour, 4, 60); // three sixteenths into beat 1
    const tick = ticker.next(fourFour, 2, 60);
    expect(tick).toMatchObject({ click: 0, main: false });
    expect(ticker.next(fourFour, 2, 60)).toMatchObject({ click: 1, main: true });
  });

  it("goes back to the downbeat on request", () => {
    const ticker = new MetronomeTicker(fourFour, 0);
    take(ticker, 2, fourFour, 1, 100);
    ticker.restartBar();
    expect(ticker.next(meterFor("7/8"), 1, 100)).toMatchObject({ click: 0, accent: 0 });
  });
});

describe("MetronomeTicker bars", () => {
  const threeFour = meterFor("3/4");

  it("numbers song bars from the start bar, leaving the count-in out", () => {
    const ticker = new MetronomeTicker(threeFour, 1, 8);
    expect(ticker.upcoming()).toEqual({ bar: 8, click: 0 });
    const ticks = take(ticker, 9, threeFour, 1, 120);
    expect(ticks.map((t) => t.bar)).toEqual([null, null, null, 8, 8, 8, 9, 9, 9]);
  });

  it("says which bar and click comes next, even between subdivisions", () => {
    const ticker = new MetronomeTicker(threeFour, 0, 0);
    take(ticker, 3, threeFour, 2, 120); // downbeat, its eighth, beat 2
    expect(ticker.upcoming()).toEqual({ bar: 0, click: 1 });
    take(ticker, 3, threeFour, 2, 120);
    expect(ticker.upcoming()).toEqual({ bar: 1, click: 0 });
  });

  it("jumps to a bar on the next downbeat, not mid-bar", () => {
    const ticker = new MetronomeTicker(threeFour, 0, 0);
    ticker.next(threeFour, 1, 120);
    ticker.jumpTo(20);
    expect(take(ticker, 4, threeFour, 1, 120).map((t) => t.bar)).toEqual([0, 0, 20, 20]);
  });

  it("lets a jump during the count-in move where the music starts", () => {
    const ticker = new MetronomeTicker(threeFour, 1, 0);
    ticker.next(threeFour, 1, 120);
    ticker.jumpTo(5);
    expect(ticker.upcoming().bar).toBe(5);
    expect(take(ticker, 3, threeFour, 1, 120).map((t) => t.bar)).toEqual([null, null, 5]);
  });
});
