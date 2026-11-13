"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type Accent, METERS, type Meter, meterFor, secondsPerClick } from "@/domain/meter";
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
}

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
  initialBpm,
  initialTimeSignature,
  labels,
}: {
  initialBpm: number;
  initialTimeSignature: string;
  labels: MetronomeLabels;
}) {
  const [bpm, setBpm] = useState(clamp(initialBpm));
  const [meter, setMeter] = useState<Meter>(() => meterFor(initialTimeSignature));
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

  const hint = meter.kind === "compound" ? labels.compoundHint : meter.kind === "odd" ? labels.oddHint : null;

  return (
    <section aria-label={labels.title} className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-sm font-semibold uppercase tracking-wide text-muted">{labels.title}</h2>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{labels.timeSignature}</span>
          <select
            value={meter.signature}
            onChange={(e) => setMeter(meterFor(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1.5"
          >
            {METERS.map((m) => (
              <option key={m.signature}>{m.signature}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1" role="group" aria-label={labels.bpm}>
          <button type="button" className="btn-icon" onClick={() => setBpm((b) => clamp(b - 1))} aria-label={labels.slower}>
            −
          </button>
          <label className="flex items-baseline gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={MIN_BPM}
              max={MAX_BPM}
              value={bpm}
              onChange={(e) => setBpm(clamp(Number(e.target.value) || MIN_BPM))}
              className="w-16 rounded-md border border-border bg-background px-2 py-1 text-center text-lg font-semibold tabular-nums"
            />
            <span className="text-sm text-muted">{labels.bpm}</span>
          </label>
          <button type="button" className="btn-icon" onClick={() => setBpm((b) => clamp(b + 1))} aria-label={labels.faster}>
            +
          </button>
        </div>
        <button type="button" className="btn-secondary" onClick={tap}>
          {labels.tap}
        </button>
        <button type="button" className="btn-primary min-w-24" onClick={() => (running ? stop() : void start())}>
          {running ? labels.stop : labels.start}
        </button>
      </div>

      <div className="mt-3 flex items-end gap-1.5" aria-hidden="true">
        {meter.accents.map((accent, i) => (
          <span
            key={`${meter.signature}-${i}`}
            className={`flex-1 rounded-full transition-colors duration-75 ${
              accent === 0 ? "h-4" : accent === 1 ? "h-3" : "h-2"
            } ${click === i ? (accent === 0 ? "bg-accent" : "bg-foreground") : "bg-border"}`}
          />
        ))}
      </div>
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
      <p className="sr-only" aria-live="off">
        {click !== null ? format(labels.beat, { beat: click + 1, total: meter.accents.length }) : ""}
      </p>
    </section>
  );
}
