"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
}

const MIN_BPM = 30;
const MAX_BPM = 300;
/** How often the scheduler wakes up, in milliseconds. */
const LOOKAHEAD_MS = 25;
/** How far ahead clicks are scheduled on the audio clock, in seconds. */
const SCHEDULE_AHEAD_S = 0.1;

const clamp = (bpm: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));

/**
 * Clicks are scheduled on the Web Audio clock a little ahead of time instead
 * of being fired from setInterval, which drifts and sounds uneven.
 */
export function Metronome({
  initialBpm,
  beatsPerBar,
  labels,
}: {
  initialBpm: number;
  beatsPerBar: number;
  labels: MetronomeLabels;
}) {
  const [bpm, setBpm] = useState(clamp(initialBpm));
  const [running, setRunning] = useState(false);
  const [beat, setBeat] = useState<number | null>(null);

  const bpmRef = useRef(bpm);
  const contextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const nextNoteTime = useRef(0);
  const nextBeat = useRef(0);
  const queue = useRef<{ beat: number; time: number }[]>([]);
  const taps = useRef<number[]>([]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  const click = useCallback((context: AudioContext, accent: boolean, time: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accent ? 1600 : 1000;
    gain.gain.setValueAtTime(accent ? 0.9 : 0.6, time);
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
    setBeat(null);
  }, []);

  const start = useCallback(async () => {
    const context = contextRef.current ?? new AudioContext();
    contextRef.current = context;
    await context.resume();

    nextBeat.current = 0;
    nextNoteTime.current = context.currentTime + 0.05;

    timerRef.current = window.setInterval(() => {
      while (nextNoteTime.current < context.currentTime + SCHEDULE_AHEAD_S) {
        click(context, nextBeat.current === 0, nextNoteTime.current);
        queue.current.push({ beat: nextBeat.current, time: nextNoteTime.current });
        nextNoteTime.current += 60 / bpmRef.current;
        nextBeat.current = (nextBeat.current + 1) % beatsPerBar;
      }
    }, LOOKAHEAD_MS);

    const draw = () => {
      let current: number | null = null;
      while (queue.current.length > 0 && (queue.current[0]?.time ?? Infinity) <= context.currentTime) {
        current = queue.current.shift()?.beat ?? null;
      }
      if (current !== null) setBeat(current);
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    setRunning(true);
  }, [beatsPerBar, click]);

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

  return (
    <section aria-label={labels.title} className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-sm font-semibold uppercase tracking-wide text-muted">{labels.title}</h2>
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
      <div className="mt-3 flex gap-2" aria-hidden="true">
        {Array.from({ length: beatsPerBar }, (_, i) => (
          <span
            key={i}
            className={`h-3 flex-1 rounded-full transition-colors duration-75 ${
              beat === i ? (i === 0 ? "bg-accent" : "bg-foreground") : "bg-border"
            }`}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="off">
        {beat !== null ? format(labels.beat, { beat: beat + 1, total: beatsPerBar }) : ""}
      </p>
    </section>
  );
}
