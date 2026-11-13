import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { SongSummary } from "@/domain/song";
import { tempoMarking } from "@/domain/tempo";
import { type Locale, hasLocale } from "@/i18n/config";
import { type Dictionary, getDictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { useCases } from "@/infrastructure/container";

export default async function HomePage({ params, searchParams }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-col gap-8">
      <section className="card relative overflow-hidden px-5 py-8 sm:px-10 sm:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-accent-soft opacity-70 blur-3xl"
        />
        <div className="relative max-w-3xl space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] font-bold tracking-wider text-accent uppercase">
            <span aria-hidden="true">♪</span> {dict.home.heroEyebrow}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">
            {dict.home.heroTitle}
          </h1>
          <p className="max-w-2xl text-base text-muted sm:text-lg">{dict.home.heroSubtitle}</p>
        </div>
        <Suspense fallback={<SearchForm dict={dict} query="" />}>
          <SearchFromParams dict={dict} searchParams={searchParams} />
        </Suspense>
      </section>

      <Suspense fallback={<p className="text-muted">{dict.home.loading}</p>}>
        <SongResults lang={lang} dict={dict} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function readQuery(searchParams: SearchParams): Promise<string> {
  const { q } = await searchParams;
  return typeof q === "string" ? q : "";
}

async function SearchFromParams({ dict, searchParams }: { dict: Dictionary; searchParams: SearchParams }) {
  return <SearchForm dict={dict} query={await readQuery(searchParams)} />;
}

function SearchForm({ dict, query }: { dict: Dictionary; query: string }) {
  return (
    <form role="search" className="relative mt-8 flex flex-col gap-2 rounded-2xl bg-surface p-2 sm:flex-row">
      <label htmlFor="q" className="sr-only">
        {dict.home.searchLabel}
      </label>
      <div className="relative flex-1">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={dict.home.searchPlaceholder}
          className="input min-h-14 border-transparent pl-12 text-lg"
        />
      </div>
      <button type="submit" className="btn-primary min-h-14 px-6">
        {dict.home.searchButton}
      </button>
    </form>
  );
}

async function SongResults({ lang, dict, searchParams }: { lang: Locale; dict: Dictionary; searchParams: SearchParams }) {
  const query = await readQuery(searchParams);
  const songs = await useCases.searchSongs().execute(query);

  if (songs.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-4 px-6 py-12 text-center">
        <p className="font-display text-xl font-semibold">
          {query ? format(dict.home.noResults, { query }) : dict.home.empty}
        </p>
        {query && <p className="text-muted">{dict.home.noResultsHint}</p>}
        <Link href={`/${lang}/songs/new`} className="btn-primary">
          {dict.home.emptyCta}
        </Link>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">{dict.home.title}</h2>
        <p className="text-sm text-muted">
          {query
            ? format(songs.length === 1 ? dict.home.resultsQueryOne : dict.home.resultsQuery, {
                count: songs.length,
                query,
              })
            : songs.length === 1
              ? dict.home.resultsOne
              : format(dict.home.resultsAll, { count: songs.length })}
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {songs.map((song, index) => (
          <li key={song.slug}>
            <SongRow song={song} index={index} href={`/${lang}/songs/${song.slug}`} dict={dict} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function SongRow({ song, index, href, dict }: { song: SongSummary; index: number; href: string; dict: Dictionary }) {
  return (
    <Link
      href={href}
      className="card group flex flex-col gap-4 p-4 transition hover:border-border-strong hover:shadow-elevated sm:flex-row sm:items-center sm:p-5"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="hidden size-12 shrink-0 items-center justify-center rounded-xl bg-surface font-mono text-sm font-bold text-muted sm:flex">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold group-hover:text-accent">{song.title}</p>
          <p className="truncate text-sm text-muted">
            {song.artist}
            {song.arrangementCount > 1 && (
              <span className="ml-2 rounded-full bg-secondary-soft px-2 py-0.5 font-mono text-[11px] font-semibold text-secondary">
                {format(dict.home.versionsCount, { count: song.arrangementCount })}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge label={dict.home.keyLabel} value={song.originalKey} tone="accent" />
        {song.tempo !== null && (
          <Badge
            label={dict.home.tempoLabel}
            value={`${song.tempo}`}
            unit="BPM"
            tone="secondary"
            title={dict.tempoMarkings[tempoMarking(song.tempo)]}
          />
        )}
        <Badge label={dict.home.timeLabel} value={song.timeSignature} tone="neutral" />
        <span className="ml-auto inline-flex items-center gap-1 pl-2 text-sm font-semibold text-accent sm:ml-2">
          {dict.home.viewChart}
          <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

function Badge({
  label,
  value,
  unit,
  tone,
  title,
}: {
  label: string;
  value: string;
  unit?: string;
  tone: "accent" | "secondary" | "neutral";
  title?: string;
}) {
  const tones = {
    accent: "bg-accent-soft text-accent",
    secondary: "bg-secondary-soft text-secondary",
    neutral: "bg-surface text-foreground",
  } as const;
  return (
    <span title={title} className={`flex min-w-16 flex-col rounded-lg px-3 py-1.5 ${tones[tone]}`}>
      <span className="font-mono text-[10px] font-semibold tracking-wider uppercase opacity-80">{label}</span>
      <span className="font-mono text-base leading-tight font-bold">
        {value}
        {unit && <span className="ml-1 text-[10px] font-semibold">{unit}</span>}
      </span>
    </span>
  );
}
