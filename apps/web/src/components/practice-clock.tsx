"use client";

import { createContext, useContext } from "react";
import type { TempoMap } from "@/domain/tempo-map";

/**
 * What the song page's parts tell each other. `downbeat` fires when the
 * first click of a song bar sounds (count-in excluded) and carries that
 * bar, so whatever follows it moves with what the player hears. `map`
 * fires when the sheet's tempo map changes.
 */
export type ClockEvent =
  | { readonly type: "start" }
  | { readonly type: "downbeat"; readonly bar: number }
  | { readonly type: "stop" }
  | { readonly type: "map" };

interface MetronomeControls {
  readonly toggle: () => void;
  readonly isRunning: () => boolean;
  /** Plays `bar` on the next downbeat. */
  readonly jumpTo: (bar: number) => void;
}

/**
 * A small event hub between the metronome and the chord sheet. It is not
 * React state on purpose: a beat must not re-render the whole song view.
 */
export class PracticeClock {
  private readonly listeners = new Set<(event: ClockEvent) => void>();
  private controls: MetronomeControls | null = null;
  private startProvider: (() => number) | null = null;
  private map: TempoMap | null = null;

  subscribe(listener: (event: ClockEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: ClockEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  /** The metronome registers how to drive it; returns the undo. */
  attach(controls: MetronomeControls): () => void {
    this.controls = controls;
    return () => {
      if (this.controls === controls) this.controls = null;
    };
  }

  toggleMetronome(): void {
    this.controls?.toggle();
  }

  isMetronomeRunning(): boolean {
    return this.controls?.isRunning() ?? false;
  }

  jumpTo(bar: number): void {
    this.controls?.jumpTo(bar);
  }

  /** Whoever follows the sheet says which bar playback starts on. */
  provideStart(provider: () => number): () => void {
    this.startProvider = provider;
    return () => {
      if (this.startProvider === provider) this.startProvider = null;
    };
  }

  /** Bar the metronome should start on: where the sheet is, or the top. */
  startBar(): number {
    return this.startProvider?.() ?? 0;
  }

  setMap(map: TempoMap): void {
    if (this.map === map) return;
    this.map = map;
    this.emit({ type: "map" });
  }

  getMap(): TempoMap | null {
    return this.map;
  }
}

export const PracticeClockContext = createContext<PracticeClock | null>(null);

/** The song page's clock, or null outside a song view. */
export function usePracticeClock(): PracticeClock | null {
  return useContext(PracticeClockContext);
}
