"use client";

import {
  type Key,
  formatKey,
  parseChordProSong,
  parseKey,
  shapeKey,
  suggestCapos,
  transposeChordPro,
  transposeKey,
} from "@acordia/chord-engine";
import { useMemo, useState } from "react";
import { format } from "@/i18n/format";
import { ChordSheet, type SectionLabels } from "./chord-sheet";

export interface SongViewLabels {
  readonly key: string;
  readonly keyHelp: string;
  readonly originalKey: string;
  readonly transposeDown: string;
  readonly transposeUp: string;
  readonly reset: string;
  readonly capo: string;
  readonly capoHelp: string;
  readonly noCapo: string;
  readonly capoOption: string;
  readonly capoSuggested: string;
  readonly playShapes: string;
  readonly chordErrors: string;
  readonly sections: SectionLabels;
}

const MAX_CAPO = 7;

/** Interactive chord chart: transpose by semitones and pick a capo fret. */
export function SongView({
  chordpro,
  writtenKey,
  labels,
}: {
  chordpro: string;
  writtenKey: string;
  labels: SongViewLabels;
}) {
  const [semitones, setSemitones] = useState(0);
  const [capo, setCapo] = useState(0);
  const original = useMemo(() => parseKey(writtenKey), [writtenKey]);

  const view = useMemo(() => {
    if (!original) return null;
    // Keep the author's spelling at 0; otherwise pick the most readable key.
    const sounding: Key = semitones === 0 ? original : transposeKey(original, semitones);
    const shapes = capo === 0 ? sounding : shapeKey(sounding, capo);
    const transposed = transposeChordPro(chordpro, original, shapes);
    return {
      sounding,
      shapes,
      song: parseChordProSong(transposed.text),
      errors: transposed.errors,
      suggested: new Set(suggestCapos(sounding).map((option) => option.fret)),
    };
  }, [chordpro, original, semitones, capo]);

  if (!original || !view) {
    return <ChordSheet song={parseChordProSong(chordpro)} labels={labels.sections} />;
  }

  const step = (delta: number) => setSemitones((s) => (((s + delta) % 12) + 12) % 12);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{labels.key}</span>
            <button type="button" className="btn-icon" onClick={() => step(-1)} aria-label={labels.transposeDown}>
              −
            </button>
            <output className="min-w-12 text-center text-xl font-bold tabular-nums" aria-live="polite">
              {formatKey(view.sounding)}
            </output>
            <button type="button" className="btn-icon" onClick={() => step(1)} aria-label={labels.transposeUp}>
              +
            </button>
            {semitones !== 0 && (
              <button
                type="button"
                className="text-sm text-accent underline-offset-2 hover:underline"
                onClick={() => setSemitones(0)}
              >
                {labels.reset}
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            {labels.keyHelp} {format(labels.originalKey, { key: writtenKey })}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{labels.capo}</span>
            <select
              value={capo}
              onChange={(e) => setCapo(Number(e.target.value))}
              className="rounded-md border border-border bg-background px-2 py-1.5"
            >
              <option value={0}>{labels.noCapo}</option>
              {Array.from({ length: MAX_CAPO }, (_, i) => i + 1).map((fret) => (
                <option key={fret} value={fret}>
                  {format(labels.capoOption, { fret, key: formatKey(shapeKey(view.sounding, fret)) })}
                  {view.suggested.has(fret) ? ` · ${labels.capoSuggested}` : ""}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted">{labels.capoHelp}</p>
        </div>
      </div>

      {capo > 0 && (
        <p className="rounded-lg bg-accent/10 px-3 py-2 text-sm">
          {format(labels.playShapes, {
            sounding: formatKey(view.sounding),
            key: formatKey(view.shapes),
            fret: capo,
          })}
        </p>
      )}

      {view.errors.length > 0 && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
          {format(labels.chordErrors, { chords: view.errors.map((e) => e.symbol).join(", ") })}
        </p>
      )}

      <ChordSheet song={view.song} labels={labels.sections} />
    </div>
  );
}
