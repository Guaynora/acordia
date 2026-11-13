"use client";

import { parseChordProSong } from "@acordia/chord-engine";
import { useActionState, useDeferredValue, useMemo, useRef, useState } from "react";
import { type PublishField, normalizeKeyInput, prepareSource } from "@/application/publish-song";
import type { PublishFormState } from "@/app/[lang]/songs/new/actions";
import { TIME_SIGNATURES } from "@/domain/song";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { ChordSheet } from "./chord-sheet";

type Action = (state: PublishFormState, form: FormData) => Promise<PublishFormState>;

const INITIAL: PublishFormState = { errors: [], unexpected: false };

export function UploadForm({
  action,
  labels,
  sections,
}: {
  action: Action;
  labels: Dictionary["upload"];
  sections: Dictionary["song"]["sections"];
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);
  // Controlled fields so values survive a failed submission.
  const [fields, setFields] = useState({
    title: "",
    artist: "",
    key: "",
    tempo: "",
    timeSignature: "4/4",
    source: "",
    recordings: "",
  });
  const set = (name: keyof typeof fields) => (event: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [name]: event.target.value }));

  // Tap tempo: average the last few intervals between presses.
  const taps = useRef<number[]>([]);
  const tap = () => {
    const now = performance.now();
    taps.current = [...taps.current.filter((t) => now - t < 2000), now].slice(-5);
    const first = taps.current[0];
    if (taps.current.length < 2 || first === undefined) return;
    const bpm = Math.round(60000 / ((now - first) / (taps.current.length - 1)));
    setFields((f) => ({ ...f, tempo: String(Math.min(300, Math.max(30, bpm))) }));
  };

  const deferredSource = useDeferredValue(fields.source);
  const preview = useMemo(() => {
    if (!deferredSource.trim()) return null;
    const prepared = prepareSource(deferredSource, normalizeKeyInput(fields.key));
    return { song: parseChordProSong(prepared.chordpro), errors: prepared.errors };
  }, [deferredSource, fields.key]);

  const errorsFor = (field: PublishField) =>
    state.errors
      .filter((e) => e.field === field)
      .map((e) => format(labels.errors[e.code], { detail: e.detail ?? "" }));

  return (
    <form action={formAction} className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={labels.titleLabel} errors={errorsFor("title")}>
            <input name="title" required value={fields.title} onChange={set("title")} className="input" />
          </Field>
          <Field label={labels.artistLabel} errors={errorsFor("artist")}>
            <input name="artist" required value={fields.artist} onChange={set("artist")} className="input" />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field label={labels.keyLabel} help={labels.keyHelp} errors={errorsFor("key")}>
            <input name="key" required value={fields.key} onChange={set("key")} className="input" autoComplete="off" />
          </Field>
          <Field label={labels.tempoLabel} help={labels.tempoHelp} errors={errorsFor("tempo")}>
            <div className="flex gap-2">
              <input
                name="tempo"
                required
                inputMode="numeric"
                value={fields.tempo}
                onChange={set("tempo")}
                className="input"
              />
              <button type="button" className="btn-secondary px-3" onClick={tap}>
                {labels.tap}
              </button>
            </div>
          </Field>
          <Field label={labels.timeSignatureLabel} errors={errorsFor("timeSignature")}>
            <select name="timeSignature" value={fields.timeSignature} onChange={set("timeSignature")} className="input">
              {TIME_SIGNATURES.map((ts) => (
                <option key={ts}>{ts}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={labels.sourceLabel} help={labels.intro} errors={errorsFor("source")}>
          <textarea
            name="source"
            required
            rows={16}
            value={fields.source}
            onChange={set("source")}
            placeholder={labels.sourcePlaceholder}
            spellCheck={false}
            className="input font-mono text-sm"
          />
        </Field>
        <Field label={labels.recordingsLabel} help={labels.recordingsHelp} errors={errorsFor("recordings")}>
          <textarea
            name="recordings"
            rows={2}
            value={fields.recordings}
            onChange={set("recordings")}
            placeholder="https://www.youtube.com/watch?v=…"
            className="input text-sm"
          />
        </Field>
        {state.unexpected && (
          <p role="alert" className="text-sm text-danger">
            {labels.errors.unexpected}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={pending || (preview?.errors.length ?? 0) > 0}>
          {pending ? labels.submitting : labels.submit}
        </button>
      </div>

      <section aria-label={labels.preview} className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{labels.preview}</h2>
        {preview && preview.errors.length > 0 && (
          <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
            {format(labels.chordErrors, { chords: preview.errors.map((e) => `${e.symbol} (${e.line})`).join(", ") })}
          </p>
        )}
        <div className="min-h-40 overflow-x-auto rounded-xl border border-border bg-card p-4">
          {preview ? (
            <ChordSheet song={preview.song} labels={sections} />
          ) : (
            <p className="text-sm text-muted">{labels.previewEmpty}</p>
          )}
        </div>
      </section>
    </form>
  );
}

function Field({
  label,
  help,
  errors,
  children,
}: {
  label: string;
  help?: string;
  errors: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {help && <span className="block text-xs text-muted">{help}</span>}
      {errors.map((error) => (
        <span key={error} className="block text-sm text-danger">
          {error}
        </span>
      ))}
    </label>
  );
}
