"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  type Accent,
  METERS,
  type Meter,
  type Subdivision,
  meterFor,
  meterName,
  subdivisionsFor,
} from "@/domain/meter";
import { MetronomeTicker } from "@/domain/metronome-ticker";
import { DEFAULT_PRACTICE_BPM, type TempoMarking, tempoMarking } from "@/domain/tempo";
import { type TempoMap, bpmAt, isSteady, nextSection, sectionAt } from "@/domain/tempo-map";
import { format } from "@/i18n/format";
import { usePracticeClock } from "./practice-clock";
import { useWakeLock } from "./use-wake-lock";

export interface MetronomeLabels {
  readonly title: string;
  readonly start: string;
  readonly stop: string;
  readonly tap: string;
  readonly bpm: string;
  readonly slower: string;
  readonly faster: string;
  readonly beat: string;
  readonly timeSignature: string;
  readonly compoundHint: string;
  readonly oddHint: string;
  readonly songTempo: string;
  readonly songNoTempo: string;
  readonly backToSong: string;
  readonly relative: string;
  readonly subdivision: string;
  readonly subdivisions: Record<"1" | "2" | "3" | "4", string>;
  readonly compoundSubdivisions: Record<"1" | "2", string>;
  readonly countIn: string;
  readonly countInNone: string;
  readonly countInOne: string;
  readonly countInBars: string;
  readonly counting: string;
  readonly mute: string;
  readonly unmute: string;
  readonly silentHint: string;
  readonly followingSong: string;
  readonly now: string;
  readonly next: string;
}

const MIN_BPM = 30;
const MAX_BPM = 300;
/** How often the scheduler wakes up, in milliseconds. */
const LOOKAHEAD_MS = 25;
/** How far ahead clicks are scheduled on the audio clock, in seconds. */
const SCHEDULE_AHEAD_S = 0.1;

const CLICK: Record<Accent | "sub", { frequency: number; volume: number }> = {
  0: { frequency: 1600, volume: 0.9 },
  1: { frequency: 1250, volume: 0.7 },
  2: { frequency: 1000, volume: 0.45 },
  sub: { frequency: 800, volume: 0.22 },
};
/** Count-in clicks sound higher, so the start of the music is unmistakable. */
const COUNT_IN_PITCH = 1.35;

/** One main click as the screen should show it. */
interface Shown {
  readonly time: number;
  readonly click: number;
  /** Clicks left in the count-in, counting this one; null once playing. */
  readonly countdown: number | null;
  /** Song bar; null during the count-in. */
  readonly bar: number | null;
  /** What was playing at this click, which may differ from the controls when following the song. */
  readonly meter: Meter;
  readonly bpm: number;
}

/**
 * Tempo and meter for the next click. Following the song, they come from
 * its tempo map, scaled by how far the player moved the BPM from the
 * song's (practicing at 80 % slows every section); otherwise from the
 * controls.
 */
function nextClickSettings(
  ticker: MetronomeTicker,
  map: TempoMap | null,
  controls: { meter: Meter; bpm: number },
): { meter: Meter; bpm: number } {
  if (!map) return controls;
  const { bar, click } = ticker.upcoming();
  const meter = sectionAt(map, bar).meter;
  const songStart = map.sections[0]?.bpm ?? controls.bpm;
  return { meter, bpm: bpmAt(map, bar + click / meter.accents.length) * (controls.bpm / songStart) };
}

const clamp = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));

/**
 * Clicks are scheduled on the Web Audio clock a little ahead of time instead
 * of being fired from setInterval, which drifts and sounds uneven. Tempo and
 * time signature can change while it plays; the next click picks them up.
 */
export function Metronome({
  songBpm,
  songTimeSignature,
  labels,
  markings,
}: {
  /** The song's own tempo, or null when the author gave none. */
  songBpm: number | null;
  songTimeSignature: string;
  labels: MetronomeLabels;
  markings: Record<TempoMarking, string>;
}) {
  const songMeter = meterFor(songTimeSignature);
  const [bpm, setBpm] = useState(clamp(songBpm ?? DEFAULT_PRACTICE_BPM));
  // What the user is typing; clamped only when they leave the field, so
  // typing "120" does not jump to 30 at the "1" and then to 300.
  const [bpmDraft, setBpmDraft] = useState<string | null>(null);
  const [meter, setMeter] = useState<Meter>(songMeter);
  const [subdivision, setSubdivision] = useState<Subdivision>(1);
  const [countInBars, setCountInBars] = useState(0);
  const [muted, setMuted] = useState(false);
  const [running, setRunning] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  useWakeLock(running);
  // Lets the chord sheet follow the bars and start or stop the metronome.
  const clock = usePracticeClock();
  const runningRef = useRef(false);

  // The song's tempo map, published by the chord sheet.
  const subscribeMap = useCallback(
    (notify: () => void) => clock?.subscribe((event) => event.type === "map" && notify()) ?? (() => {}),
    [clock],
  );
  const map = useSyncExternalStore(
    subscribeMap,
    () => clock?.getMap() ?? null,
    () => null,
  );
  const songChanges = map !== null && !isSteady(map);
  // Picking a meter by hand leaves the song's changes for free practice.
  const [follow, setFollow] = useState(true);
  const following = follow && songChanges;
  const followMapRef = useRef<TempoMap | null>(null);
  useEffect(() => {
    followMapRef.current = following ? map : null;
  }, [following, map]);

  const bpmRef = useRef(bpm);
  const countInBarsRef = useRef(countInBars);
  const meterRef = useRef(meter);
  const subdivisionRef = useRef(subdivision);
  const mutedRef = useRef(muted);
  const tickerRef = useRef<MetronomeTicker | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const nextClickTime = useRef(0);
  const queue = useRef<Shown[]>([]);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    meterRef.current = meter;
    // Restart counting from the downbeat in the new meter.
    tickerRef.current?.restartBar();
  }, [meter]);

  useEffect(() => {
    countInBarsRef.current = countInBars;
  }, [countInBars]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // A meter without the chosen subdivision (triplets in 6/8) falls back to none.
  const available = subdivisionsFor(meter);
  const activeSubdivision = available.includes(subdivision) ? subdivision : 1;
  useEffect(() => {
    if (activeSubdivision !== subdivisionRef.current) subdivisionRef.current = activeSubdivision;
  }, [activeSubdivision]);

  const sound = useCallback((context: AudioContext, accent: Accent | "sub", time: number, countIn: boolean) => {
    if (mutedRef.current) return;
    const { frequency, volume } = CLICK[accent];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = countIn ? frequency * COUNT_IN_PITCH : frequency;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.05);
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    timerRef.current = null;
    frameRef.current = null;
    queue.current = [];
    const wasRunning = runningRef.current;
    runningRef.current = false;
    setRunning(false);
    setShown(null);
    if (wasRunning) clock?.emit({ type: "stop" });
  }, [clock]);

  const start = useCallback(async () => {
    const context = contextRef.current ?? new AudioContext();
    contextRef.current = context;
    await context.resume();

    // Where the sheet says to start; the count-in plays that section's meter.
    const startBar = clock?.startBar() ?? 0;
    const startMap = followMapRef.current;
    const startMeter = startMap ? sectionAt(startMap, startBar).meter : meterRef.current;
    const ticker = new MetronomeTicker(startMeter, countInBarsRef.current, startBar);
    tickerRef.current = ticker;
    nextClickTime.current = context.currentTime + 0.05;

    timerRef.current = window.setInterval(() => {
      while (nextClickTime.current < context.currentTime + SCHEDULE_AHEAD_S) {
        const time = nextClickTime.current;
        const { meter, bpm } = nextClickSettings(ticker, followMapRef.current, {
          meter: meterRef.current,
          bpm: bpmRef.current,
        });
        // A section may switch to a meter without the chosen subdivision.
        const subdivision = subdivisionsFor(meter).includes(subdivisionRef.current) ? subdivisionRef.current : 1;
        const tick = ticker.next(meter, subdivision, bpm);
        // Count-in clicks sound higher so the start of the music is clear.
        sound(context, tick.accent, time, tick.countdown !== null);
        if (tick.main) {
          queue.current.push({ time, click: tick.click, countdown: tick.countdown, bar: tick.bar, meter, bpm });
        }
        nextClickTime.current += tick.duration;
      }
    }, LOOKAHEAD_MS);

    const draw = () => {
      let latest: Shown | null = null;
      while (queue.current.length > 0 && (queue.current[0]?.time ?? Infinity) <= context.currentTime) {
        latest = queue.current.shift() ?? null;
        // A bar of the music (not the count-in) starts as this click sounds.
        if (latest?.bar != null && latest.click === 0) clock?.emit({ type: "downbeat", bar: latest.bar });
      }
      if (latest) setShown(latest);
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    runningRef.current = true;
    setRunning(true);
    clock?.emit({ type: "start" });
  }, [sound, clock]);

  useEffect(
    () =>
      clock?.attach({
        toggle: () => (runningRef.current ? stop() : void start()),
        isRunning: () => runningRef.current,
        jumpTo: (bar) => tickerRef.current?.jumpTo(bar),
      }),
    [clock, start, stop],
  );

  useEffect(
    () => () => {
      stop();
      void contextRef.current?.close();
    },
    [stop],
  );

  const tap = () => {
    const now = performance.now();
    const recent = taps.current.filter((t) => now - t < 2000);
    recent.push(now);
    taps.current = recent.slice(-5);
    if (taps.current.length >= 2) {
      const first = taps.current[0] ?? now;
      const average = (now - first) / (taps.current.length - 1);
      setBpm(clamp(60000 / average));
    }
  };

  const changed =
    (songBpm !== null && bpm !== songBpm) || meter.signature !== songMeter.signature || (songChanges && !follow);
  const resetToSong = () => {
    setBpm(clamp(songBpm ?? DEFAULT_PRACTICE_BPM));
    setMeter(songMeter);
    setFollow(true);
  };
  const pickMeter = (signature: string) => {
    setMeter(meterFor(signature));
    setFollow(false);
  };

  // Following the song, show what is playing now (or where it starts).
  const playingMeter = following ? (running && shown ? shown.meter : (map?.sections[0]?.meter ?? meter)) : meter;
  const hint =
    playingMeter.kind === "compound" ? labels.compoundHint : playingMeter.kind === "odd" ? labels.oddHint : null;
  const click = shown?.click ?? null;
  const counting = shown?.countdown != null;
  // Warn a bar ahead of a section that changes tempo or meter.
  const upcoming = following && map && running && shown?.bar != null ? nextSection(map, shown.bar) : null;
  const scale = bpm / (map?.sections[0]?.bpm ?? bpm);
  const warning =
    upcoming && shown?.bar != null && upcoming.bar === shown.bar + 1
      ? format(labels.next, {
          bpm: Math.round((upcoming.ramp?.from ?? upcoming.bpm) * scale),
          signature: meterName(upcoming.meter),
        })
      : null;

  return (
    <section id="metronome" aria-label={labels.title} className="card scroll-mt-24 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{labels.title}</h2>
          <p className="font-mono text-xs text-muted">
            {songBpm !== null
              ? format(labels.songTempo, { bpm: songBpm, signature: songMeter.signature })
              : format(labels.songNoTempo, { signature: songMeter.signature })}
          </p>
          {following && <p className="text-xs font-semibold text-secondary">{labels.followingSong}</p>}
        </div>
        {changed && (
          <button
            type="button"
            className="shrink-0 text-right text-xs font-semibold text-accent underline-offset-2 hover:underline"
            onClick={resetToSong}
          >
            {labels.backToSong}
          </button>
        )}
      </div>

      <div className="segmented mt-4 flex flex-wrap" role="group" aria-label={labels.timeSignature}>
        {METERS.map((m) => (
          <button
            key={m.signature}
            type="button"
            aria-pressed={m.signature === playingMeter.signature}
            onClick={() => pickMeter(m.signature)}
            className="segmented-item min-h-8 px-2.5 text-xs"
          >
            {m.signature}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" className="btn-icon" onClick={() => setBpm((b) => clamp(b - 1))} aria-label={labels.slower}>
          −
        </button>
        <label className="flex flex-col items-center">
          <span className="sr-only">{labels.bpm}</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_BPM}
            max={MAX_BPM}
            value={bpmDraft ?? bpm}
            onChange={(e) => {
              const text = e.target.value;
              setBpmDraft(text);
              // Follow along live while the number typed is already in range.
              const typed = Number(text);
              if (text !== "" && typed >= MIN_BPM && typed <= MAX_BPM) setBpm(Math.round(typed));
            }}
            onBlur={() => {
              const typed = Number(bpmDraft);
              if (bpmDraft !== null && bpmDraft.trim() !== "" && Number.isFinite(typed)) setBpm(clamp(typed));
              setBpmDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className="w-24 bg-transparent text-center font-mono text-4xl font-bold tabular-nums outline-none [appearance:textfield] focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-accent/30 [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span aria-hidden="true" className="eyebrow">
            {labels.bpm}
          </span>
        </label>
        <button type="button" className="btn-icon" onClick={() => setBpm((b) => clamp(b + 1))} aria-label={labels.faster}>
          +
        </button>
      </div>

      <p className="mt-1 text-center text-xs text-muted">
        <span className="font-semibold text-secondary">{markings[tempoMarking(bpm)]}</span>
        {songBpm !== null && bpm !== songBpm
          ? ` · ${format(labels.relative, { percent: Math.round((bpm / songBpm) * 100) })}`
          : ""}
      </p>

      {following && running && shown && shown.bar !== null && (
        <p className="mt-2 text-center font-mono text-xs" aria-live="polite">
          {format(labels.now, { bpm: Math.round(shown.bpm), signature: meterName(shown.meter) })}
        </p>
      )}
      {warning && (
        <p role="status" className="mt-2 rounded-lg bg-secondary-soft px-3 py-1.5 text-center text-xs font-semibold">
          {warning}
        </p>
      )}

      <div className="relative mt-4" aria-hidden="true">
        <div className="flex items-end gap-1">
          {playingMeter.accents.map((accent, i) => (
            <span
              key={`${playingMeter.signature}-${i}`}
              className={`flex flex-1 items-center justify-center rounded-md font-mono text-[10px] font-bold transition-colors duration-75 ${
                accent === 0 ? "h-8" : accent === 1 ? "h-6" : "h-5"
              } ${
                click === i && !counting
                  ? accent === 0
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-secondary-foreground"
                  : click === i && counting
                    ? "bg-foreground text-background"
                    : "bg-surface-strong text-muted"
              }`}
            >
              {playingMeter.accents.length <= 7 ? i + 1 : ""}
            </span>
          ))}
        </div>
        {/* Count-in: the clicks left, big enough to read from the instrument */}
        {counting && shown?.countdown != null && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-card/85 font-mono text-2xl font-bold">
            {format(labels.counting, { count: shown.countdown })}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-2">
        <button type="button" className="btn-secondary" onClick={tap}>
          {labels.tap}
        </button>
        <button type="button" className="btn-primary relative" onClick={() => (running ? stop() : void start())}>
          {/* Flash on every beat: the pulse stays visible with the sound off */}
          {running && shown && (
            <span
              key={shown.time}
              aria-hidden="true"
              className={`beat-flash pointer-events-none absolute inset-0 rounded-lg ring-4 ${
                shown.click === 0 ? "ring-accent" : "ring-secondary"
              }`}
            />
          )}
          {running ? labels.stop : labels.start}
        </button>
        <button
          type="button"
          className="btn-icon"
          aria-pressed={muted}
          aria-label={muted ? labels.unmute : labels.mute}
          title={muted ? labels.unmute : labels.mute}
          onClick={() => setMuted((m) => !m)}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5 6 9H2v6h4l5 4z" />
            {muted ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
          </svg>
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div>
          <p className="eyebrow mb-1.5">{labels.subdivision}</p>
          <div className="segmented flex flex-wrap" role="group" aria-label={labels.subdivision}>
            {available.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={activeSubdivision === value}
                onClick={() => setSubdivision(value)}
                className="segmented-item min-h-8 flex-1 px-2 text-xs"
              >
                {meter.kind === "compound"
                  ? labels.compoundSubdivisions[String(value) as "1" | "2"]
                  : labels.subdivisions[String(value) as "1" | "2" | "3" | "4"]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow mb-1.5">{labels.countIn}</p>
          <div className="segmented flex" role="group" aria-label={labels.countIn}>
            {[0, 1, 2].map((bars) => (
              <button
                key={bars}
                type="button"
                aria-pressed={countInBars === bars}
                onClick={() => setCountInBars(bars)}
                className="segmented-item min-h-8 flex-1 px-2 text-xs"
              >
                {bars === 0 ? labels.countInNone : bars === 1 ? labels.countInOne : format(labels.countInBars, { bars })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {muted && running && <p className="mt-3 text-xs text-muted">{labels.silentHint}</p>}
      {hint && <p className="mt-3 text-xs text-muted">{hint}</p>}
      <p className="sr-only" aria-live="off">
        {click !== null ? format(labels.beat, { beat: click + 1, total: playingMeter.accents.length }) : ""}
      </p>
    </section>
  );
}
