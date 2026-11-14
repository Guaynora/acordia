"use client";

import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { type ScrollTimeline, stepIndexAt } from "@/domain/scroll-timeline";
import type { PlayingPosition } from "./chord-sheet";
import type { PracticeClock } from "./practice-clock";
import { useWakeLock } from "./use-wake-lock";

export interface AutoScrollLabels {
  readonly title: string;
  readonly play: string;
  readonly pause: string;
  readonly restart: string;
  readonly tempoMode: string;
  readonly manualMode: string;
  readonly speed: string;
}

export type ScrollMode = "tempo" | "manual";

/** Pixels per second for each manual speed step. */
const SPEEDS = [8, 12, 18, 25, 35, 50, 70, 95] as const;
const DEFAULT_SPEED = 2;
/** Where the playing line settles, as a fraction of the viewport height. */
const READING_LINE = 0.35;
/** Room taken by the sticky site header; lines under it count as hidden. */
const HEADER_OFFSET = 80;

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/**
 * Moves the page while the user plays. In tempo mode it follows the
 * metronome: every downbeat it hears moves the sheet one bar, so tempo,
 * meter and count-in all come from the metronome and the two never drift.
 * In manual mode it scrolls at a constant speed on its own.
 */
export function useAutoScroll({
  timeline,
  clock,
  canFollow,
  sheetRef,
}: {
  timeline: ScrollTimeline;
  clock: PracticeClock;
  /** False when the page has no metronome to follow. */
  canFollow: boolean;
  sheetRef: RefObject<HTMLElement | null>;
}) {
  const followable = canFollow && timeline.steps.length > 0;
  const [mode, setMode] = useState<ScrollMode>("tempo");
  const [manualPlaying, setManualPlaying] = useState(false);
  const [metronomeRunning, setMetronomeRunning] = useState(false);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [position, setPosition] = useState<PlayingPosition | null>(null);
  const activeMode: ScrollMode = followable ? mode : "manual";

  // The loops read the latest values without restarting.
  const live = useRef({ timeline, speed, stepIndex: -1 });
  // Set by the tempo-mode effect: jump to a step, playing or not.
  const jumpRef = useRef<((index: number) => void) | null>(null);
  useEffect(() => {
    Object.assign(live.current, { timeline, speed });
  }, [timeline, speed]);

  useWakeLock(manualPlaying);

  const lineElement = useCallback(
    (line: number) => sheetRef.current?.querySelector<HTMLElement>(`[data-line="${line}"]`) ?? null,
    [sheetRef],
  );

  const showLine = useCallback(
    (line: number) => {
      const element = lineElement(line);
      if (!element) return;
      const top = element.getBoundingClientRect().top + window.scrollY - window.innerHeight * READING_LINE;
      window.scrollTo({ top: Math.max(0, top), behavior: scrollBehavior() });
    },
    [lineElement],
  );

  /** Step to start from: the one paused on if still in view, else the first visible line. */
  const startIndex = useCallback((): number => {
    const { steps } = live.current.timeline;
    const paused = steps[live.current.stepIndex];
    if (paused) {
      const rect = lineElement(paused.line)?.getBoundingClientRect();
      if (rect && rect.bottom > HEADER_OFFSET && rect.top < window.innerHeight) return live.current.stepIndex;
    }
    const first = steps.findIndex((step) => {
      const rect = lineElement(step.line)?.getBoundingClientRect();
      return rect !== undefined && rect.bottom > HEADER_OFFSET;
    });
    return Math.max(0, first);
  }, [lineElement]);

  // The metronome's state drives the play button in tempo mode.
  useEffect(
    () =>
      clock.subscribe((event) => {
        if (event.type === "start" || event.type === "stop") setMetronomeRunning(event.type === "start");
      }),
    [clock],
  );

  // Tempo mode: the metronome counts the song's bars and each downbeat says
  // which one sounds; the sheet shows it. The sheet only says where to start.
  useEffect(() => {
    if (activeMode !== "tempo") return;
    let shownLine = -1;
    let following = false;

    const place = (index: number) => {
      const step = live.current.timeline.steps[index];
      if (!step) return null;
      live.current.stepIndex = index;
      following = true;
      if (step.line !== shownLine) {
        shownLine = step.line;
        showLine(step.line);
      }
      return step;
    };

    const onDownbeat = (bar: number) => {
      if (!following) return;
      const index = stepIndexAt(live.current.timeline, bar);
      if (index === null) {
        // The song is over; the metronome may keep going.
        following = false;
        live.current.stepIndex = -1;
        setPosition(null);
        return;
      }
      const step = place(index);
      if (step) setPosition({ line: step.line, segment: step.segment });
    };

    // Asked by the metronome as it starts: bring the first line into place
    // during the count-in and tell it which bar that is.
    const releaseStart = clock.provideStart(() => place(startIndex())?.startBar ?? 0);

    // Move to a step. Playing, the next downbeat plays it; stopped, the
    // next start begins there (it is in view after this scroll).
    jumpRef.current = (index: number) => {
      const step = place(index);
      if (!step) return;
      setPosition({ line: step.line, segment: step.segment });
      if (clock.isMetronomeRunning()) clock.jumpTo(step.startBar);
    };

    // Switching to tempo mode while the metronome plays: join from the first visible line.
    if (clock.isMetronomeRunning()) jumpRef.current(startIndex());

    const unsubscribe = clock.subscribe((event) => {
      if (event.type === "downbeat") onDownbeat(event.bar);
      // On stop, keep the highlight and step so play resumes from there.
      else if (event.type === "stop") following = false;
    });
    return () => {
      unsubscribe();
      releaseStart();
      jumpRef.current = null;
    };
  }, [activeMode, clock, startIndex, showLine]);

  // Manual mode: a steady scroll.
  useEffect(() => {
    if (activeMode !== "manual" || !manualPlaying) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const tick = (now: number) => {
      carry += ((SPEEDS[live.current.speed] ?? SPEEDS[DEFAULT_SPEED]) * (now - last)) / 1000;
      last = now;
      const whole = Math.trunc(carry);
      if (whole > 0) {
        window.scrollBy(0, whole);
        carry -= whole;
      }
      const end = document.documentElement.scrollHeight - window.innerHeight;
      if (window.scrollY >= end - 1) {
        setManualPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [activeMode, manualPlaying]);

  const changeMode = (next: ScrollMode) => {
    setManualPlaying(false);
    setPosition(null);
    live.current.stepIndex = -1;
    setMode(next);
  };

  return {
    mode: activeMode,
    setMode: changeMode,
    canFollow: followable,
    playing: activeMode === "tempo" ? metronomeRunning : manualPlaying,
    /** Back to the top of the sheet; in tempo mode the next bar plays the first chord. */
    restart: () => {
      if (jumpRef.current) jumpRef.current(0);
      else sheetRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    },
    /** Play from this line of the parsed song (or the next one with something to play). */
    startFrom: (line: number) => {
      const index = live.current.timeline.steps.findIndex((step) => step.line >= line);
      if (index < 0) return;
      if (jumpRef.current) jumpRef.current(index);
      else showLine(live.current.timeline.steps[index]?.line ?? line);
    },
    /** In tempo mode this starts or stops the metronome itself. */
    toggle: () => (activeMode === "tempo" ? clock.toggleMetronome() : setManualPlaying((p) => !p)),
    speed,
    setSpeed: (value: number) => setSpeed(Math.min(SPEEDS.length - 1, Math.max(0, value))),
    speedCount: SPEEDS.length,
    position: activeMode === "tempo" ? position : null,
  };
}

export type AutoScroll = ReturnType<typeof useAutoScroll>;

export function AutoScrollCard({ scroll, labels }: { scroll: AutoScroll; labels: AutoScrollLabels }) {
  return (
    <section aria-label={labels.title} className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{labels.title}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={scroll.restart}
            aria-label={labels.restart}
            title={labels.restart}
            className="btn-icon size-10 text-sm"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={scroll.toggle}
            aria-pressed={scroll.playing}
            className="btn-primary min-h-10 px-4 text-sm"
          >
            {scroll.playing ? labels.pause : labels.play}
          </button>
        </div>
      </div>

      <div className="segmented mt-4 flex" role="group" aria-label={labels.title}>
        <button
          type="button"
          aria-pressed={scroll.mode === "tempo"}
          disabled={!scroll.canFollow}
          onClick={() => scroll.setMode("tempo")}
          className="segmented-item flex-1 text-sm disabled:opacity-50"
        >
          {labels.tempoMode}
        </button>
        <button
          type="button"
          aria-pressed={scroll.mode === "manual"}
          onClick={() => scroll.setMode("manual")}
          className="segmented-item flex-1 text-sm"
        >
          {labels.manualMode}
        </button>
      </div>

      {scroll.mode === "manual" && (
        <label className="mt-4 flex flex-col gap-2">
          <span className="flex items-center justify-between text-sm">
            <span>{labels.speed}</span>
            <span className="font-mono text-xs text-muted tabular-nums">
              {scroll.speed + 1}/{scroll.speedCount}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={scroll.speedCount - 1}
            step={1}
            value={scroll.speed}
            onChange={(e) => scroll.setSpeed(Number(e.target.value))}
            className="accent-accent"
          />
        </label>
      )}
    </section>
  );
}
