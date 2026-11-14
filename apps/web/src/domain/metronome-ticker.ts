import { type Accent, type Meter, type Subdivision, barSteps, countInClicks, secondsPerClick, secondsPerStep } from "./meter";

/** One scheduled tick: what to play and how long until the next one. */
export interface Tick {
  readonly accent: Accent | "sub";
  /** Main click index in the bar. */
  readonly click: number;
  /** True for main clicks (shown on screen), false for subdivisions. */
  readonly main: boolean;
  /** Count-in clicks left including this one; null once the music plays. */
  readonly countdown: number | null;
  /** Seconds until the next tick. */
  readonly duration: number;
}

/**
 * The metronome's sequence: an optional count-in of whole bars (main clicks
 * only), then bars with their subdivisions. Tempo, meter and subdivision
 * are read on every tick, so they can change while it plays.
 */
export class MetronomeTicker {
  private click = 0;
  private sub = 0;
  private countInLeft: number;

  constructor(meter: Meter, countInBars: number) {
    this.countInLeft = countInClicks(meter, countInBars);
  }

  /** Back to the downbeat, as when the meter changes. */
  restartBar(): void {
    this.click = 0;
    this.sub = 0;
  }

  next(meter: Meter, subdivision: Subdivision, bpm: number): Tick {
    const click = this.click % meter.accents.length;
    const accent = meter.accents[click] ?? 2;

    if (this.countInLeft > 0) {
      const countdown = this.countInLeft;
      this.countInLeft -= 1;
      this.click = (click + 1) % meter.accents.length;
      return { accent, click, main: true, countdown, duration: secondsPerClick(meter, bpm) };
    }

    // The subdivision may have shrunk since the last tick.
    const sub = Math.min(this.sub, subdivision - 1);
    const step = barSteps(meter, subdivision)[click * subdivision + sub];
    this.sub = sub + 1;
    if (this.sub >= subdivision) {
      this.sub = 0;
      this.click = (click + 1) % meter.accents.length;
    }
    return {
      accent: step?.accent ?? accent,
      click,
      main: sub === 0,
      countdown: null,
      duration: secondsPerStep(meter, bpm, subdivision),
    };
  }
}
