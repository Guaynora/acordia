"use client";

import {
  BASS_TUNING,
  chordTones,
  formatNote,
  fretPositions,
  parseChord,
  pianoVoicing,
  pitchClass,
} from "@acordia/chord-engine";
import { useMemo, useSyncExternalStore } from "react";
import { format } from "@/i18n/format";
import { BassFretboard } from "./bass-fretboard";
import { PianoKeyboard } from "./piano-keyboard";

export interface InstrumentLabels {
  readonly title: string;
  readonly piano: string;
  readonly bass: string;
  readonly pick: string;
  readonly bassNote: string;
  readonly soundingHint: string;
  readonly close: string;
  readonly noTones: string;
  readonly leftHand: string;
  readonly rightHand: string;
}

type Instrument = "piano" | "bass";
const STORAGE_KEY = "acordia-instrument";
const BASS_STRINGS = ["E", "A", "D", "G"];

const CHANGE_EVENT = "acordia-instrument-change";

// Fallback for this visit when storage is blocked.
let remembered: Instrument | null = null;

function readInstrument(): Instrument {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "bass" || saved === "piano") return saved;
  } catch {
    // Storage blocked: use the in-memory choice.
  }
  return remembered ?? "piano";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The instrument the viewer picked last time; piano on the server and by default. */
function useInstrument(): [Instrument, (value: Instrument) => void] {
  const instrument = useSyncExternalStore(subscribe, readInstrument, () => "piano" as const);
  const choose = (value: Instrument) => {
    remembered = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // Storage unavailable: nothing to remember.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [instrument, choose];
}

/**
 * Shows how to play the song's chords on piano or bass. `chords` are the
 * sounding chords (never capo shapes: a capo only concerns the guitar).
 */
export function InstrumentPanel({
  chords,
  selected,
  onSelect,
  capo,
  labels,
  onClose,
}: {
  chords: readonly string[];
  selected: number | null;
  onSelect: (index: number) => void;
  capo: number;
  labels: InstrumentLabels;
  onClose?: (() => void) | undefined;
}) {
  const [instrument, setInstrument] = useInstrument();
  const symbol = selected !== null ? chords[selected] : undefined;

  const view = useMemo(() => {
    const chord = symbol ? parseChord(symbol) : null;
    const tones = chord ? chordTones(chord) : null;
    if (!tones) return null;
    const names = new Map<number, string>();
    for (const tone of tones.tones) names.set(pitchClass(tone.note), formatNote(tone.note));
    names.set(pitchClass(tones.bass), formatNote(tones.bass));
    const voicing = pianoVoicing(tones);
    const top = Math.max(...voicing.right, voicing.left);
    const from = voicing.left - (voicing.left % 12);
    const to = top - (top % 12) + 11;
    return { tones, names, voicing, from, to, bassName: formatNote(tones.bass) };
  }, [symbol]);

  return (
    <section className="card flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">{labels.title}</h2>
        <div className="flex items-center gap-2">
          <div className="segmented" role="group" aria-label={labels.title}>
            {(["piano", "bass"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={instrument === value}
                onClick={() => setInstrument(value)}
                className="segmented-item px-3 text-sm"
              >
                {labels[value]}
              </button>
            ))}
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="btn-icon size-9" aria-label={labels.close}>
              ×
            </button>
          )}
        </div>
      </div>

      {chords.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chords.map((chord, index) => (
            <button
              key={chord}
              type="button"
              aria-pressed={selected === index}
              onClick={() => onSelect(index)}
              className="rounded-full border border-border-strong px-2.5 py-1 font-mono text-xs font-bold text-accent hover:bg-accent-soft aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            >
              {chord}
            </button>
          ))}
        </div>
      )}

      {!symbol ? (
        <p className="text-sm text-muted">{labels.pick}</p>
      ) : !view ? (
        <p className="text-sm text-muted">{format(labels.noTones, { chord: symbol })}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-2xl font-bold text-accent">{symbol}</p>
            <dl className="flex gap-2 font-mono text-xs">
              {view.tones.tones.map((tone) => (
                <div key={tone.degree} className="flex flex-col items-center">
                  <dt className="font-bold">{formatNote(tone.note)}</dt>
                  <dd className="text-muted">{tone.degree}</dd>
                </div>
              ))}
            </dl>
          </div>

          {instrument === "piano" ? (
            <>
              <PianoKeyboard
                from={view.from}
                to={view.to}
                left={[view.voicing.left]}
                right={view.voicing.right}
                names={view.names}
                label={`${labels.piano}: ${symbol}`}
              />
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span>
                  <span className="mr-1 inline-block size-2.5 rounded-sm bg-secondary align-middle" aria-hidden="true" />
                  {labels.leftHand}
                </span>
                <span>
                  <span className="mr-1 inline-block size-2.5 rounded-sm bg-accent align-middle" aria-hidden="true" />
                  {labels.rightHand}
                </span>
              </p>
            </>
          ) : (
            <>
              <BassFretboard
                positions={fretPositions(view.tones.bass, BASS_TUNING, 12)}
                stringNames={BASS_STRINGS}
                noteName={view.bassName}
                label={`${labels.bass}: ${symbol}`}
              />
              <p className="text-xs text-muted">{format(labels.bassNote, { note: view.bassName })}</p>
            </>
          )}
        </div>
      )}

      {capo > 0 && <p className="text-xs text-muted">{labels.soundingHint}</p>}
    </section>
  );
}
