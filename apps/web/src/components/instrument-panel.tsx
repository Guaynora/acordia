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
import { type FretShape } from "@acordia/chord-engine";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { format } from "@/i18n/format";
import { type FrettedInstrument, STRING_NAMES, findShapes, loadLibrary } from "@/lib/fingerings";
import { BassFretboard } from "./bass-fretboard";
import { ChordDiagram } from "./chord-diagram";
import { PianoKeyboard } from "./piano-keyboard";

export interface InstrumentLabels {
  readonly title: string;
  readonly piano: string;
  readonly bass: string;
  readonly bassNote: string;
  readonly soundingHint: string;
  readonly close: string;
  readonly noTones: string;
  readonly leftHand: string;
  readonly rightHand: string;
  readonly guitar: string;
  readonly ukulele: string;
  readonly position: string;
  readonly previous: string;
  readonly next: string;
  readonly loading: string;
  readonly noShape: string;
  readonly capoShape: string;
  readonly generated: string;
}

const INSTRUMENTS = ["guitar", "piano", "bass", "ukulele"] as const;
type Instrument = (typeof INSTRUMENTS)[number];
const isFretted = (i: Instrument): i is FrettedInstrument => i === "guitar" || i === "ukulele";
const STORAGE_KEY = "acordia-instrument";
const BASS_STRINGS = ["E", "A", "D", "G"];

const CHANGE_EVENT = "acordia-instrument-change";

// Fallback for this visit when storage is blocked.
let remembered: Instrument | null = null;

function readInstrument(): Instrument {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if ((INSTRUMENTS as readonly string[]).includes(saved ?? "")) return saved as Instrument;
  } catch {
    // Storage blocked: use the in-memory choice.
  }
  return remembered ?? "guitar";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The instrument the viewer picked last time; guitar on the server and by default. */
function useInstrument(): [Instrument, (value: Instrument) => void] {
  const instrument = useSyncExternalStore(subscribe, readInstrument, () => "guitar" as const);
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

/** The fingering library for a fretted instrument, once it has downloaded. */
function useLibrary(instrument: Instrument): readonly FretShape[] | null {
  const [loaded, setLoaded] = useState<{ instrument: Instrument; shapes: FretShape[] } | null>(null);
  useEffect(() => {
    if (!isFretted(instrument)) return;
    let active = true;
    loadLibrary(instrument).then((shapes) => {
      if (active) setLoaded({ instrument, shapes });
    });
    return () => {
      active = false;
    };
  }, [instrument]);
  return loaded?.instrument === instrument ? loaded.shapes : null;
}

/**
 * Shows how to play the song's chords. Piano and bass get `chords`, the
 * sounding chords; guitar and ukulele get `shapeChords`, which differ only
 * with a capo (the shapes the player's hand makes).
 */
export function InstrumentPanel({
  chords,
  shapeChords,
  selected,
  onSelect,
  capo,
  labels,
  onClose,
}: {
  chords: readonly string[];
  shapeChords: readonly string[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  capo: number;
  labels: InstrumentLabels;
  onClose?: (() => void) | undefined;
}) {
  const [instrument, setInstrument] = useInstrument();
  const library = useLibrary(instrument);
  const fretted = isFretted(instrument);
  const list = fretted ? shapeChords : chords;
  const symbol = selected !== null ? list[selected] : undefined;
  const sounding = selected !== null ? chords[selected] : undefined;
  // Which position of the chord is shown; back to the first for a new chord.
  const [position, setPosition] = useState({ key: "", index: 0 });
  const positionKey = `${instrument}|${symbol ?? ""}`;
  const positionIndex = position.key === positionKey ? position.index : 0;

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
    const shapes = fretted && library ? findShapes(tones, library, instrument) : null;
    return { tones, names, voicing, from, to, bassName: formatNote(tones.bass), shapes };
  }, [symbol, fretted, library, instrument]);

  return (
    <section className="card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{labels.title}</h2>
        <div className="flex items-center gap-2">
          <div className="segmented flex-wrap" role="group" aria-label={labels.title}>
            {INSTRUMENTS.map((value) => (
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

      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map((chord, index) => (
            <button
              key={chord}
              type="button"
              aria-pressed={selected === index}
              // Picking the chord shown again clears the selection.
              onClick={() => onSelect(selected === index ? null : index)}
              className="rounded-full border border-border-strong px-2.5 py-1 font-mono text-xs font-bold text-accent hover:bg-accent-soft aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            >
              {chord}
            </button>
          ))}
        </div>
      )}

      {!symbol ? null : !view ? (
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

          {fretted ? (
            <FrettedView
              instrument={instrument}
              shapes={view.shapes}
              index={positionIndex}
              onIndex={(index) => setPosition({ key: positionKey, index })}
              symbol={symbol}
              labels={labels}
            />
          ) : instrument === "piano" ? (
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

      {capo > 0 &&
        (fretted ? (
          symbol &&
          sounding && <p className="text-xs text-muted">{format(labels.capoShape, { shape: symbol, sounding, capo })}</p>
        ) : (
          <p className="text-xs text-muted">{labels.soundingHint}</p>
        ))}
    </section>
  );
}

function FrettedView({
  instrument,
  shapes,
  index,
  onIndex,
  symbol,
  labels,
}: {
  instrument: FrettedInstrument;
  shapes: readonly FretShape[] | null;
  index: number;
  onIndex: (index: number) => void;
  symbol: string;
  labels: InstrumentLabels;
}) {
  if (!shapes) return <p className="text-sm text-muted">{labels.loading}</p>;
  if (shapes.length === 0) return <p className="text-sm text-muted">{format(labels.noShape, { chord: symbol })}</p>;
  const current = Math.min(index, shapes.length - 1);
  const shape = shapes[current];
  if (!shape) return null;
  const step = (delta: number) => onIndex((current + delta + shapes.length) % shapes.length);

  return (
    <div className="flex flex-col items-center gap-2">
      <ChordDiagram shape={shape} stringNames={STRING_NAMES[instrument]} label={`${labels[instrument]}: ${symbol}`} />
      {shapes.length > 1 && (
        <div className="flex items-center gap-3">
          <button type="button" className="btn-icon size-9" onClick={() => step(-1)} aria-label={labels.previous}>
            ‹
          </button>
          <span className="font-mono text-xs text-muted tabular-nums" aria-live="polite">
            {format(labels.position, { current: current + 1, total: shapes.length })}
          </span>
          <button type="button" className="btn-icon size-9" onClick={() => step(1)} aria-label={labels.next}>
            ›
          </button>
        </div>
      )}
      {!shape.fingers && <p className="text-center text-xs text-muted">{labels.generated}</p>}
    </div>
  );
}
