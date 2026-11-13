"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Accent, METERS, type Meter, meterFor, secondsPerClick } from "@/domain/meter";
import { type TempoMarking, tempoMarking } from "@/domain/tempo";
import { format } from "@/i18n/format";

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
}

const DEFAULT_BPM = 90;

const MIN_BPM = 30;
const MAX_BPM = 300;
/** How often the scheduler wakes up, in milliseconds. */
const LOOKAHEAD_MS = 25;
/** How far ahead clicks are scheduled on the audio clock, in seconds. */
const SCHEDULE_AHEAD_S = 0.1;

const CLICK: Record<Accent, { frequency: number; volume: number }> = {
  0: { frequency: 1600, volume: 0.9 },
  1: { frequency: 1250, volume: 0.7 },
  2: { frequency: 1000, volume: 0.45 },
};

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
  const [bpm, setBpm] = useState(clamp(songBpm ?? DEFAULT_BPM));
  const [meter, setMeter] = useState<Meter>(songMeter);
  const [running, setRunning] = useState(false);
  const [click, setClick] = useState<number | null>(null);

  const bpmRef = useRef(bpm);
  const meterRef = useRef(meter);
  const contextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const nextClickTime = useRef(0);
  const nextClick = useRef(0);
  const queue = useRef<{ click: number; time: number }[]>([]);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    meterRef.current = meter;
    // Restart counting from the downbeat in the new meter.
    nextClick.current = 0;
  }, [meter]);

  const sound = useCallback((context: AudioContext, accent: Accent, time: number) => {
    const { frequency, volume } = CLICK[accent];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
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
    setRunning(false);
    setClick(null);
  }, []);

  const start = useCallback(async () => {
    const context = contextRef.current ?? new AudioContext();
    contextRef.current = context;
    await context.resume();

    nextClick.current = 0;
    nextClickTime.current = context.currentTime + 0.05;

    timerRef.current = window.setInterval(() => {
      while (nextClickTime.current < context.currentTime + SCHEDULE_AHEAD_S) {
        const current = meterRef.current;
        const index = nextClick.current % current.accents.length;
        sound(context, current.accents[index] ?? 2, nextClickTime.current);
        queue.current.push({ click: index, time: nextClickTime.current });
        nextClickTime.current += secondsPerClick(current, bpmRef.current);
        nextClick.current = (index + 1) % current.accents.length;
      }
    }, LOOKAHEAD_MS);

    const draw = () => {
      let current: number | null = null;
      while (queue.current.length > 0 && (queue.current[0]?.time ?? Infinity) <= context.currentTime) {
        current = queue.current.shift()?.click ?? null;
      }
      if (current !== null) setClick(current);
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    setRunning(true);
  }, [sound]);

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

  const changed = (songBpm !== null && bpm !== songBpm) || meter.signature !== songMeter.signature;
  const resetToSong = () => {
    setBpm(clamp(songBpm ?? DEFAULT_BPM));
    setMeter(songMeter);
  };

  const hint = meter.kind === "compound" ? labels.compoundHint : meter.kind === "odd" ? labels.oddHint : null;

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
            aria-pressed={m.signature === meter.signature}
            onClick={() => setMeter(meterFor(m.signature))}
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
            value={bpm}
            onChange={(e) => setBpm(clamp(Number(e.target.value) || MIN_BPM))}
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

      <div className="mt-4 flex items-end gap-1" aria-hidden="true">
        {meter.accents.map((accent, i) => (
          <span
            key={`${meter.signature}-${i}`}
            className={`flex flex-1 items-center justify-center rounded-md font-mono text-[10px] font-bold transition-colors duration-75 ${
              accent === 0 ? "h-8" : accent === 1 ? "h-6" : "h-5"
            } ${
              click === i
                ? accent === 0
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-secondary-foreground"
                : "bg-surface-strong text-muted"
            }`}
          >
            {meter.accents.length <= 7 ? i + 1 : ""}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
        <button type="button" className="btn-secondary" onClick={tap}>
          {labels.tap}
        </button>
        <button type="button" className="btn-primary" onClick={() => (running ? stop() : void start())}>
          {running ? labels.stop : labels.start}
        </button>
      </div>

      {hint && <p className="mt-3 text-xs text-muted">{hint}</p>}
      <p className="sr-only" aria-live="off">
        {click !== null ? format(labels.beat, { beat: click + 1, total: meter.accents.length }) : ""}
      </p>
    </section>
  );
}
