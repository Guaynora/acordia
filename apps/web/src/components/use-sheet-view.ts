"use client";

import { useSyncExternalStore } from "react";

/**
 * How the chord sheet is drawn: chords over lyrics, the same with chords as
 * scale degrees (Nashville numbers), lyrics only for singers, or a grid of
 * bars for players who already know the words.
 */
export const SHEET_VIEWS = ["chords", "degrees", "lyrics", "grid"] as const;
export type SheetView = (typeof SHEET_VIEWS)[number];

const STORAGE_KEY = "acordia-sheet-view";
const CHANGE_EVENT = "acordia-sheet-view-change";

// Fallback for this visit when storage is blocked.
let remembered: SheetView | null = null;

function readView(): SheetView {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if ((SHEET_VIEWS as readonly string[]).includes(saved ?? "")) return saved as SheetView;
  } catch {
    // Storage blocked: use the in-memory choice.
  }
  return remembered ?? "chords";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The view the viewer picked last time; chords on the server and by default. */
export function useSheetView(): [SheetView, (view: SheetView) => void] {
  const view = useSyncExternalStore(subscribe, readView, () => "chords" as const);
  const choose = (next: SheetView) => {
    remembered = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice lasts for this visit.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [view, choose];
}
