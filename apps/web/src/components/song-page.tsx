import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, Suspense } from "react";
import { isFeatureEnabled } from "@/config/features";
import type { Arrangement, Song } from "@/domain/song";
import { tempoMarking } from "@/domain/tempo";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { useCases } from "@/infrastructure/container";
import { Metronome } from "./metronome";
import { Recordings } from "./recordings";
import { SongView } from "./song-view";
import { FavoriteButton } from "./favorite-button";
import { VersionActions } from "./version-actions";

/**
 * Song page body. Without `versionSlug` it shows the first (original)
 * arrangement; with it, that version of the song.
 */
export async function SongPageContent({
  lang,
  dict,
  slug,
  versionSlug,
}: {
  lang: Locale;
  dict: Dictionary;
  slug: string;
  versionSlug?: string;
}) {
  const song = await useCases.getSong().execute(slug);
  const arrangement = versionSlug
    ? song?.arrangements.find((a) => a.slug === versionSlug)
    : song?.arrangements[0];
  if (!song || !arrangement) notFound();

  const tempo = arrangement.tempo ?? song.tempo;
  const timeSignature = arrangement.timeSignature ?? song.timeSignature;

  return (
    <article className="flex flex-col gap-6">
      <header className="card flex flex-col gap-5 p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">{song.title}</h1>
            <p className="text-muted">
              {dict.song.by} <span className="font-semibold text-foreground">{song.artist}</span>
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
            <Stat label={dict.song.key} value={arrangement.key} accent />
            <Stat
              label={dict.song.tempoLabel}
              value={tempo !== null ? `${tempo}` : "—"}
              unit={tempo !== null ? "BPM" : undefined}
              note={tempo !== null ? dict.tempoMarkings[tempoMarking(tempo)].split(" · ")[0] : dict.song.noTempo}
            />
            <Stat label={dict.song.timeSignatureLabel} value={timeSignature} />
          </dl>
        </div>

        <VersionPicker lang={lang} dict={dict} song={song} current={arrangement} />
      </header>

      <SongView
        // Remount when switching versions so key and capo start fresh.
        key={arrangement.id}
        chordpro={arrangement.chordpro}
        writtenKey={arrangement.key}
        autoScroll={isFeatureEnabled("autoScroll")}
        labels={dict.song}
        aside={
          <>
            <Metronome
              songBpm={tempo}
              songTimeSignature={timeSignature}
              labels={dict.metronome}
              markings={dict.tempoMarkings}
            />
            <Recordings recordings={song.recordings} labels={dict.song.recordingLabels} />
          </>
        }
      />
    </article>
  );
}

function VersionPicker({
  lang,
  dict,
  song,
  current,
}: {
  lang: Locale;
  dict: Dictionary;
  song: Song;
  current: Arrangement;
}) {
  const base = `/${lang}/songs/${song.slug}`;
  const author = current.authorHandle ? (
    <Link href={`/${lang}/u/${current.authorHandle}`} className="font-semibold text-foreground hover:underline">
      {current.authorName}
    </Link>
  ) : (
    current.authorName
  );
  const [byBefore = "", byAfter = ""] = dict.song.versionBy.split("{author}");
  const details = [
    current.kind !== "original" ? dict.song.kinds[current.kind] : null,
    current.authorName ? (
      <span key="author">
        {byBefore}
        {author}
        {byAfter}
      </span>
    ) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="eyebrow mr-1">{dict.song.versions}</span>
        <nav aria-label={dict.song.versions} className="flex flex-wrap gap-2">
          {song.arrangements.map((arrangement, index) => {
            const selected = arrangement.id === current.id;
            return (
              <Link
                key={arrangement.id}
                // The first version lives at the song URL itself.
                href={index === 0 ? base : `${base}/${arrangement.slug}`}
                aria-current={selected ? "page" : undefined}
                className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition ${
                  selected
                    ? "border-secondary bg-secondary text-secondary-foreground"
                    : "border-border-strong hover:bg-surface"
                }`}
              >
                {arrangement.name}
                <span className={`font-mono text-[11px] ${selected ? "opacity-80" : "text-muted"}`}>
                  {arrangement.key}
                </span>
              </Link>
            );
          })}
        </nav>
        <Link
          href={`${base}/new`}
          className="inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-accent hover:bg-accent-soft"
        >
          <span aria-hidden="true">+</span> {dict.song.addVersion}
        </Link>
      </div>
      {(details.length > 0 || current.description) && (
        <p className="text-sm text-muted">
          {details.length > 0 && (
            <span className="font-semibold text-foreground">
              {details.map((detail, i) => (
                <Fragment key={i}>
                  {i > 0 && " · "}
                  {detail}
                </Fragment>
              ))}
            </span>
          )}
          {details.length > 0 && current.description ? " — " : ""}
          {current.description}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Suspense fallback={null}>
          <FavoriteButton lang={lang} dict={dict} song={song} current={current} />
        </Suspense>
        <Suspense fallback={null}>
          <VersionActions lang={lang} dict={dict} song={song} current={current} />
        </Suspense>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string | undefined;
  note?: string | undefined;
  accent?: boolean;
}) {
  return (
    <div className={`min-w-24 rounded-xl px-4 py-2.5 ${accent ? "bg-accent-soft" : "bg-surface"}`}>
      <dt className={`eyebrow ${accent ? "text-accent" : ""}`}>{label}</dt>
      <dd className="flex items-baseline gap-1">
        <span className={`font-mono text-xl font-bold ${accent ? "text-accent" : ""}`}>{value}</span>
        {unit && <span className="font-mono text-[11px] text-muted">{unit}</span>}
      </dd>
      {note && <dd className="text-xs text-muted">{note}</dd>}
    </div>
  );
}
