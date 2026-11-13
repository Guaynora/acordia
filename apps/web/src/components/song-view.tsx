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
import { type ReactNode, useMemo, useState } from "react";
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
  readonly fontSize: string;
  readonly fontSmaller: string;
  readonly fontLarger: string;
  readonly metronomeShortcut: string;
  readonly sections: SectionLabels;
}

const MAX_CAPO = 7;
const FONT_SIZES = [14, 16, 18, 20, 22, 26, 30] as const;
const DEFAULT_FONT_INDEX = 2;

/**
 * The practice view: chord sheet on the left, key and capo tools on the right
 * (plus whatever the page passes as `aside`), and a thumb-reachable bar on
 * phones.
 */
export function SongView({
  chordpro,
  writtenKey,
  labels,
  aside,
}: {
  chordpro: string;
  writtenKey: string;
  labels: SongViewLabels;
  aside?: ReactNode;
}) {
  const [semitones, setSemitones] = useState(0);
  const [capo, setCapo] = useState(0);
  const [fontIndex, setFontIndex] = useState(DEFAULT_FONT_INDEX);
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
      suggested: suggestCapos(sounding).filter((option) => option.fret > 0),
    };
  }, [chordpro, original, semitones, capo]);

  const fontSize = FONT_SIZES[fontIndex] ?? 18;
  const step = (delta: number) => setSemitones((s) => (((s + delta) % 12) + 12) % 12);
  const resize = (delta: number) => setFontIndex((i) => Math.min(FONT_SIZES.length - 1, Math.max(0, i + delta)));

  if (!original || !view) {
    return (
      <div className="card p-5 sm:p-8">
        <ChordSheet song={parseChordProSong(chordpro)} labels={labels.sections} fontSize={fontSize} />
      </div>
    );
  }

  const soundingName = formatKey(view.sounding);
  const capoSelect = (className: string) => (
    <select
      aria-label={labels.capo}
      value={capo}
      onChange={(e) => setCapo(Number(e.target.value))}
      className={className}
    >
      <option value={0}>{labels.noCapo}</option>
      {Array.from({ length: MAX_CAPO }, (_, i) => i + 1).map((fret) => (
        <option key={fret} value={fret}>
          {format(labels.capoOption, { fret, key: formatKey(shapeKey(view.sounding, fret)) })}
          {view.suggested.some((o) => o.fret === fret) ? ` · ${labels.capoSuggested}` : ""}
        </option>
      ))}
    </select>
  );
  const fontControls = (
    <div className="segmented" role="group" aria-label={labels.fontSize}>
      <button type="button" className="segmented-item" onClick={() => resize(-1)} aria-label={labels.fontSmaller}>
        A−
      </button>
      <span className="px-1 font-mono text-xs text-muted tabular-nums">{fontSize}px</span>
      <button type="button" className="segmented-item" onClick={() => resize(1)} aria-label={labels.fontLarger}>
        A+
      </button>
    </div>
  );

  return (
    <div className="grid items-start gap-6 pb-24 lg:grid-cols-12 lg:pb-0">
      {/* Chord sheet */}
      <section className="card p-5 sm:p-8 lg:col-span-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <p className="eyebrow">
            {labels.key} <span className="text-accent">{soundingName}</span>
            {capo > 0 && (
              <>
                {" · "}
                {labels.capo} {capo}
              </>
            )}
          </p>
          <div className="hidden lg:block">{fontControls}</div>
        </div>

        {capo > 0 && (
          <p className="mb-6 rounded-lg bg-secondary-soft px-3 py-2 text-sm text-foreground">
            {format(labels.playShapes, { sounding: soundingName, key: formatKey(view.shapes), fret: capo })}
          </p>
        )}

        {view.errors.length > 0 && (
          <p role="alert" className="mb-6 rounded-lg bg-danger-soft p-3 text-sm text-danger">
            {format(labels.chordErrors, { chords: view.errors.map((e) => e.symbol).join(", ") })}
          </p>
        )}

        <ChordSheet song={view.song} labels={labels.sections} fontSize={fontSize} />
      </section>

      {/* Practice tools */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:col-span-4">
        <section className="card hidden p-5 lg:block">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">{labels.key}</h2>
            {semitones !== 0 && (
              <button
                type="button"
                className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
                onClick={() => setSemitones(0)}
              >
                {labels.reset}
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl bg-surface p-2">
            <button type="button" className="btn-icon" onClick={() => step(-1)} aria-label={labels.transposeDown}>
              −
            </button>
            <div className="text-center">
              <output className="block font-mono text-3xl font-bold text-accent" aria-live="polite">
                {soundingName}
              </output>
              <span className="font-mono text-xs text-muted">{format(labels.originalKey, { key: writtenKey })}</span>
            </div>
            <button type="button" className="btn-icon" onClick={() => step(1)} aria-label={labels.transposeUp}>
              +
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">{labels.keyHelp}</p>
        </section>

        <section className="card hidden p-5 lg:block">
          <h2 className="mb-3 font-display text-lg font-semibold">{labels.capo}</h2>
          {capoSelect("input font-mono text-sm")}
          {view.suggested.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {view.suggested.map((option) => (
                <button
                  key={option.fret}
                  type="button"
                  aria-pressed={capo === option.fret}
                  onClick={() => setCapo(capo === option.fret ? 0 : option.fret)}
                  className="rounded-full border border-border-strong px-3 py-1 font-mono text-xs font-semibold text-secondary hover:bg-secondary-soft aria-pressed:border-secondary aria-pressed:bg-secondary aria-pressed:text-secondary-foreground"
                >
                  {format(labels.capoOption, { fret: option.fret, key: formatKey(option.shapes) })}
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm text-muted">{labels.capoHelp}</p>
        </section>

        {aside}
      </aside>

      {/* Phone toolbar: key, capo and text size within thumb reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-3 py-2 shadow-elevated backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button type="button" className="btn-icon size-10" onClick={() => step(-1)} aria-label={labels.transposeDown}>
              −
            </button>
            <div className="min-w-12 text-center">
              <span className="block text-[10px] font-semibold tracking-wider text-muted uppercase">{labels.key}</span>
              <output className="font-mono text-lg font-bold text-accent">{soundingName}</output>
            </div>
            <button type="button" className="btn-icon size-10" onClick={() => step(1)} aria-label={labels.transposeUp}>
              +
            </button>
          </div>
          {capoSelect("min-h-10 max-w-32 rounded-lg border border-border-strong bg-card px-2 font-mono text-xs")}
          <button
            type="button"
            className="btn-icon size-10 text-sm"
            onClick={() => setFontIndex((i) => (i + 1) % FONT_SIZES.length)}
            aria-label={`${labels.fontSize}: ${fontSize}px`}
          >
            Aa
          </button>
          <a href="#metronome" className="btn-icon size-10 text-base" aria-label={labels.metronomeShortcut}>
            ♩
          </a>
        </div>
      </div>
    </div>
  );
}
