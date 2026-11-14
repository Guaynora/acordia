"use client";

import { type ChordError, parseChordProSong } from "@acordia/chord-engine";
import { useActionState, useDeferredValue, useMemo, useRef, useState } from "react";
import { replaceChord } from "@/application/fix-chord";
import { type InputError, type InputField, normalizeKeyInput, prepareSource } from "@/application/song-input";
import { ARRANGEMENT_KINDS, TIME_SIGNATURES } from "@/domain/song";
import { tempoMarking } from "@/domain/tempo";
import type { Dictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { ChordSheet } from "./chord-sheet";

/** What a server action returns to the form after a failed submission. */
export interface FormState {
  readonly errors: readonly InputError[];
  readonly unexpected: boolean;
}

type Action = (state: FormState, form: FormData) => Promise<FormState>;

interface SongContext {
  readonly title: string;
  readonly artist: string;
  readonly tempo: number | null;
  readonly timeSignature: string;
}

/**
 * Uploading a new song, a new version of an existing one, or editing a
 * version. `main` is the song's first version: it has no name or kind of its
 * own and sets the song's tempo and meter.
 */
export type FormMode =
  | { readonly kind: "song" }
  | { readonly kind: "version"; readonly song: SongContext }
  | { readonly kind: "edit"; readonly main: boolean; readonly song: SongContext };

export interface FormValues {
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly key: string;
  readonly tempo: string;
  readonly timeSignature: string;
  readonly source: string;
}

const INITIAL: FormState = { errors: [], unexpected: false };

interface ChordIssue {
  readonly symbol: string;
  readonly suggestion: string | null;
  readonly lines: number[];
}

/** One entry per unknown chord, with every line where it appears. */
function groupIssues(errors: readonly ChordError[]): ChordIssue[] {
  const bySymbol = new Map<string, ChordIssue>();
  for (const error of errors) {
    const issue = bySymbol.get(error.symbol) ?? { symbol: error.symbol, suggestion: error.suggestion, lines: [] };
    if (!issue.lines.includes(error.line)) issue.lines.push(error.line);
    bySymbol.set(error.symbol, issue);
  }
  return [...bySymbol.values()];
}

export function UploadForm({
  action,
  mode,
  labels,
  song: songLabels,
  markings,
  publisher,
  initial,
}: {
  action: Action;
  mode: FormMode;
  labels: Dictionary["upload"];
  song: Dictionary["song"];
  markings: Dictionary["tempoMarkings"];
  /** Display name of the signed-in user the version will be credited to. */
  publisher: string;
  /** Current values when editing. */
  initial?: FormValues;
}) {
  const editing = mode.kind === "edit";
  // Name, kind and description, and tempo/meter that may inherit the song's.
  const isVersion = mode.kind === "version" || (mode.kind === "edit" && !mode.main);
  const context = mode.kind === "song" ? null : mode.song;
  const inherited = isVersion ? context : null;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  // Controlled fields so values survive a failed submission.
  const [fields, setFields] = useState({
    title: "",
    artist: "",
    name: "",
    kind: "reharmonization",
    description: "",
    key: "",
    tempo: "",
    // Empty in a version means "same as the song".
    timeSignature: isVersion ? "" : "4/4",
    source: "",
    recordings: "",
    ...initial,
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
    return { song: parseChordProSong(prepared.chordpro), issues: groupIssues(prepared.errors) };
  }, [deferredSource, fields.key]);
  const issues = preview?.issues ?? [];
  const fixable = issues.filter((issue) => issue.suggestion !== null);

  const fix = (list: readonly ChordIssue[]) =>
    setFields((f) => ({
      ...f,
      source: list.reduce(
        (source, issue) => (issue.suggestion ? replaceChord(source, issue.symbol, issue.suggestion, issue.lines) : source),
        f.source,
      ),
    }));

  const errorsFor = (field: InputField) =>
    state.errors
      .filter((e) => e.field === field && e.code !== "unknown_chord")
      .map((e) => format(labels.errors[e.code], { detail: e.detail ?? "" }));
  const songErrors = errorsFor("song");

  // Tempo and meter shown in the preview fall back to the song's in a version.
  const typedTempo = Number(fields.tempo);
  const tempo =
    typedTempo >= 30 && typedTempo <= 300 ? typedTempo : (inherited?.tempo ?? null);
  const timeSignature = fields.timeSignature || (inherited?.timeSignature ?? "4/4");

  const tabButton = (value: "edit" | "preview", text: string) => (
    <button type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className="segmented-item flex-1">
      {text}
    </button>
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="segmented flex lg:hidden">
        {tabButton("edit", labels.editTab)}
        {tabButton("preview", labels.previewTab)}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className={`card flex flex-col gap-6 p-5 sm:p-7 ${tab === "preview" ? "hidden lg:flex" : ""}`}>
          {isVersion ? (
            <>
              <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr]">
                <Field label={labels.nameLabel} required errors={errorsFor("name")}>
                  <input
                    name="name"
                    required
                    maxLength={60}
                    value={fields.name}
                    onChange={set("name")}
                    placeholder={labels.namePlaceholder}
                    className="input"
                  />
                </Field>
                <Field label={labels.kindLabel} errors={errorsFor("kind")}>
                  <select name="kind" value={fields.kind} onChange={set("kind")} className="input">
                    {ARRANGEMENT_KINDS.filter((k) => k !== "original").map((kind) => (
                      <option key={kind} value={kind}>
                        {songLabels.kinds[kind]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={labels.descriptionLabel} help={labels.descriptionHelp} errors={[]}>
                <input
                  name="description"
                  maxLength={280}
                  value={fields.description}
                  onChange={set("description")}
                  className="input"
                />
              </Field>
            </>
          ) : mode.kind === "song" ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={labels.titleLabel} required errors={errorsFor("title")}>
                <input name="title" required value={fields.title} onChange={set("title")} className="input" />
              </Field>
              <Field label={labels.artistLabel} required errors={errorsFor("artist")}>
                <input name="artist" required value={fields.artist} onChange={set("artist")} className="input" />
              </Field>
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-[1fr_1.3fr_1fr]">
            <Field label={labels.keyLabel} required help={labels.keyHelp} errors={errorsFor("key")}>
              <input
                name="key"
                required
                value={fields.key}
                onChange={set("key")}
                className="input text-center font-mono text-lg font-bold text-accent"
                autoComplete="off"
              />
            </Field>
            <Field
              label={labels.tempoLabel}
              required={!isVersion}
              help={
                typedTempo >= 30 && typedTempo <= 300
                  ? markings[tempoMarking(typedTempo)]
                  : inherited && inherited.tempo !== null
                    ? format(labels.tempoInheritHelp, { bpm: inherited.tempo })
                    : labels.tempoHelp
              }
              errors={errorsFor("tempo")}
            >
              <div className="flex gap-2">
                <input
                  name="tempo"
                  required={!isVersion}
                  inputMode="numeric"
                  value={fields.tempo}
                  onChange={set("tempo")}
                  placeholder={inherited && inherited.tempo !== null ? String(inherited.tempo) : undefined}
                  className="input font-mono text-lg"
                />
                <button type="button" className="btn-secondary min-h-12 px-3 font-mono text-xs" onClick={tap}>
                  {labels.tap}
                </button>
              </div>
            </Field>
            <Field label={labels.timeSignatureLabel} errors={errorsFor("timeSignature")}>
              <select
                name="timeSignature"
                value={fields.timeSignature}
                onChange={set("timeSignature")}
                className="input font-mono"
              >
                {inherited && <option value="">{format(labels.sameAsSong, { value: inherited.timeSignature })}</option>}
                {TIME_SIGNATURES.map((ts) => (
                  <option key={ts}>{ts}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label={labels.sourceLabel} required help={labels.formatHint} errors={errorsFor("source")}>
            <textarea
              name="source"
              required
              rows={16}
              value={fields.source}
              onChange={set("source")}
              placeholder={labels.sourcePlaceholder}
              spellCheck={false}
              className="input bg-surface font-mono text-sm leading-relaxed"
            />
          </Field>

          <AdvancedHelp labels={labels.advanced} />

          {issues.length > 0 && (
            <section role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-danger">{labels.chordIssueTitle}</h3>
                {fixable.length > 1 && (
                  <button type="button" className="btn-secondary min-h-9 px-3 text-sm" onClick={() => fix(fixable)}>
                    {labels.replaceAll}
                  </button>
                )}
              </div>
              <ul className="flex flex-col gap-2">
                {issues.map((issue) => (
                  <li key={issue.symbol} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="font-mono font-bold text-danger">
                      {format(labels.unknownChord, { symbol: issue.symbol, lines: issue.lines.join(", ") })}
                    </span>
                    <span className="text-foreground">
                      {issue.suggestion
                        ? format(labels.didYouMean, { suggestion: issue.suggestion })
                        : labels.noSuggestion}
                    </span>
                    {issue.suggestion && (
                      <button
                        type="button"
                        className="rounded-md bg-accent px-2.5 py-1 font-mono text-xs font-bold text-accent-foreground hover:opacity-90"
                        onClick={() => fix([issue])}
                      >
                        {format(labels.replace, { suggestion: issue.suggestion })}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted">{labels.notationHint}</p>
            </section>
          )}

          {mode.kind === "song" && (
            <Field label={labels.recordingsLabel} help={labels.recordingsHelp} errors={errorsFor("recordings")}>
              <textarea
                name="recordings"
                rows={2}
                value={fields.recordings}
                onChange={set("recordings")}
                placeholder="https://www.youtube.com/watch?v=…"
                className="input font-mono text-sm"
              />
            </Field>
          )}

          {!editing && <p className="text-sm text-muted">{format(labels.publishingAs, { name: publisher })}</p>}

          {(state.unexpected || songErrors.length > 0) && (
            <p role="alert" className="text-sm text-danger">
              {songErrors[0] ?? labels.errors.unexpected}
            </p>
          )}

          <button type="submit" className="btn-primary min-h-12 text-base" disabled={pending || issues.length > 0}>
            {pending
              ? labels.submitting
              : editing
                ? labels.saveChanges
                : isVersion
                  ? labels.submitVersion
                  : labels.submit}
          </button>
        </div>

        {/* Preview */}
        <section
          aria-label={labels.preview}
          className={`card overflow-hidden lg:sticky lg:top-20 ${tab === "edit" ? "hidden lg:block" : ""}`}
        >
          <div className="h-1.5 bg-gradient-to-r from-accent to-secondary" aria-hidden="true" />
          <div className="border-b border-border p-5 sm:p-7">
            <p className="eyebrow mb-2 flex items-center gap-2">
              <span className="inline-block size-2 rounded-full bg-secondary" aria-hidden="true" />
              {labels.preview}
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              {context ? context.title : fields.title.trim() || labels.untitled}
            </h2>
            <p className="text-muted">
              {context
                ? [context.artist, isVersion ? fields.name.trim() : ""].filter(Boolean).join(" · ")
                : fields.artist.trim() || labels.unknownArtist}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs font-semibold">
              {fields.key.trim() && (
                <span className="rounded-full bg-accent-soft px-3 py-1 text-accent">
                  {labels.keyShort}: {normalizeKeyInput(fields.key)}
                </span>
              )}
              {tempo !== null && (
                <span className="rounded-full bg-secondary-soft px-3 py-1 text-secondary">
                  {tempo} BPM · {markings[tempoMarking(tempo)].split(" · ")[0]}
                </span>
              )}
              <span className="rounded-full bg-surface px-3 py-1">{timeSignature}</span>
              {isVersion && (
                <span className="rounded-full bg-surface px-3 py-1">
                  {songLabels.kinds[fields.kind as keyof typeof songLabels.kinds] ?? ""}
                </span>
              )}
            </div>
          </div>
          <div className="max-h-[70vh] overflow-auto p-5 sm:p-7">
            {preview ? (
              <ChordSheet song={preview.song} labels={songLabels.sections} changeLabels={songLabels.changes} fontSize={16} />
            ) : (
              <p className="text-sm text-muted">{labels.previewEmpty}</p>
            )}
          </div>
        </section>
      </div>
    </form>
  );
}

function Field({
  label,
  required = false,
  help,
  errors,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  errors: string[];
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">
        {label}
        {required && (
          <span className="text-accent" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </span>
      {children}
      {help && <span className="text-xs text-muted">{help}</span>}
      {errors.map((error) => (
        <span key={error} className="text-sm text-danger">
          {error}
        </span>
      ))}
    </label>
  );
}

/** Folded reference for what the sheet can say beyond chords and lyrics. */
function AdvancedHelp({ labels }: { labels: Dictionary["upload"]["advanced"] }) {
  const example = "mt-1.5 overflow-x-auto rounded-lg bg-card px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre";
  return (
    <details className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold">{labels.title}</summary>
      <div className="mt-3 flex flex-col gap-4">
        <div>
          <p>{labels.sections}</p>
          <pre className={example}>{labels.sectionsExample}</pre>
        </div>
        <div>
          <p>{labels.bars}</p>
          <pre className={example}>{labels.barsExample}</pre>
        </div>
        <div>
          <p>{labels.repeats}</p>
          <pre className={example}>{labels.repeatsExample}</pre>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            {labels.repeatItems.map((item) => (
              <div key={item.code} className="contents">
                <dt>
                  <code className="rounded bg-card px-1.5 py-0.5 font-mono text-xs">{item.code}</code>
                </dt>
                <dd className="text-muted">{item.text}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <p>{labels.changes}</p>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            {labels.changesItems.map((item) => (
              <div key={item.code} className="contents">
                <dt>
                  <code className="rounded bg-card px-1.5 py-0.5 font-mono text-xs">{item.code}</code>
                </dt>
                <dd className="text-muted">{item.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </details>
  );
}
