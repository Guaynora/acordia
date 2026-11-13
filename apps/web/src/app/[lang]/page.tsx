import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { type Locale, hasLocale } from "@/i18n/config";
import { type Dictionary, getDictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { useCases } from "@/infrastructure/container";

export default async function HomePage({ params, searchParams }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{dict.home.title}</h1>
        <p className="text-muted">{dict.site.tagline}</p>
      </div>
      <Suspense fallback={<p className="text-muted">{dict.home.loading}</p>}>
        <SongSearch lang={lang} dict={dict} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SongSearch({
  lang,
  dict,
  searchParams,
}: {
  lang: Locale;
  dict: Dictionary;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const songs = await useCases.searchSongs().execute(query);

  return (
    <div className="space-y-6">
      <form role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          {dict.home.searchLabel}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={dict.home.searchPlaceholder}
          className="input flex-1"
        />
        <button type="submit" className="btn-secondary">
          {dict.home.searchButton}
        </button>
      </form>

      {songs.length === 0 ? (
        <p className="text-muted">{query ? format(dict.home.noResults, { query }) : dict.home.empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {songs.map((song) => (
            <li key={song.slug}>
              <Link
                href={`/${lang}/songs/${song.slug}`}
                className="flex items-baseline gap-3 px-4 py-3 hover:bg-background"
              >
                <span className="font-medium">{song.title}</span>
                <span className="text-sm text-muted">{song.artist}</span>
                <span className="ml-auto text-sm text-muted">
                  {dict.home.keyLabel} <strong className="text-accent">{song.originalKey}</strong>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
