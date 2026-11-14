"use client";

import { createContext, useContext } from "react";

/**
 * What the metronome tells the rest of the song page. `downbeat` fires when
 * the first click of a bar sounds (count-in bars excluded), so whatever
 * follows it moves with what the player hears.
 */
export type ClockEvent = { readonly type: "start" } | { readonly type: "downbeat" } | { readonly type: "stop" };

interface MetronomeControls {
  readonly toggle: () => void;
  readonly isRunning: () => boolean;
}

/**
 * A small event hub between the metronome and the chord sheet. It is not
 * React state on purpose: a beat must not re-render the whole song view.
 */
export class PracticeClock {
  private readonly listeners = new Set<(event: ClockEvent) => void>();
  private controls: MetronomeControls | null = null;

  subscribe(listener: (event: ClockEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: ClockEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  /** The metronome registers how to start and stop it; returns the undo. */
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
}

export const PracticeClockContext = createContext<PracticeClock | null>(null);

/** The song page's clock, or null outside a song view. */
export function usePracticeClock(): PracticeClock | null {
  return useContext(PracticeClockContext);
}
