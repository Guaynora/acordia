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
  /** Bar of the song this tick belongs to; null during the count-in. */
  readonly bar: number | null;
}

/** Where the next tick falls, so the caller can pick its tempo and meter. */
export interface Upcoming {
  /** Song bar; during the count-in, the bar the music will start on. */
  readonly bar: number;
  /** Main click within the bar, 0 on a downbeat. */
  readonly click: number;
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
  /** Bar the last downbeat played; the first one plays `startBar`. */
  private bar: number;
  private jump: number | null = null;

  /** `startBar` is the song bar the music starts on, after the count-in. */
  constructor(meter: Meter, countInBars: number, startBar = 0) {
    this.countInLeft = countInClicks(meter, countInBars);
    this.bar = startBar - 1;
  }

  /** Back to the downbeat, as when the meter changes. */
  restartBar(): void {
    this.click = 0;
    this.sub = 0;
  }

  /** Makes the next downbeat play `bar` instead of the following one. */
  jumpTo(bar: number): void {
    this.jump = bar;
  }

  upcoming(): Upcoming {
    if (this.countInLeft > 0) return { bar: this.jump ?? this.bar + 1, click: 0 };
    const downbeat = this.click === 0 && this.sub === 0;
    return { bar: downbeat ? (this.jump ?? this.bar + 1) : this.bar, click: this.click };
  }

  next(meter: Meter, subdivision: Subdivision, bpm: number): Tick {
    const click = this.click % meter.accents.length;
    const accent = meter.accents[click] ?? 2;

    if (this.countInLeft > 0) {
      const countdown = this.countInLeft;
      this.countInLeft -= 1;
      this.click = (click + 1) % meter.accents.length;
      return { accent, click, main: true, countdown, duration: secondsPerClick(meter, bpm), bar: null };
    }

    // The subdivision may have shrunk since the last tick.
    const sub = Math.min(this.sub, subdivision - 1);
    if (click === 0 && sub === 0) {
      this.bar = this.jump ?? this.bar + 1;
      this.jump = null;
    }
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
      bar: this.bar,
    };
  }
}
