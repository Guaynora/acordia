import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { Metronome } from "@/components/metronome";
import { Recordings } from "@/components/recordings";
import { SongView } from "@/components/song-view";
import { hasLocale } from "@/i18n/config";
import { type Dictionary, getDictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { useCases } from "@/infrastructure/container";

export default async function SongPage({ params }: PageProps<"/[lang]/songs/[slug]">) {
  // Read only the language here: it is known at build time, while the slug
  // is runtime data that must be awaited inside the Suspense boundary.
  const lang = await rootLang();
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <Suspense fallback={<p className="text-muted">{dict.song.loading}</p>}>
      <SongContent params={params} dict={dict} />
    </Suspense>
  );
}

async function SongContent({ params, dict }: { params: Promise<{ slug: string }>; dict: Dictionary }) {
  const { slug } = await params;
  const song = await useCases.getSong().execute(slug);
  const arrangement = song?.arrangements[0];
  if (!song || !arrangement) notFound();

  return (
    <article className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{song.title}</h1>
        <p className="text-muted">
          {dict.song.by} {song.artist}
          {song.tempo ? ` · ${format(dict.song.tempo, { bpm: song.tempo })}` : ""} · {song.timeSignature}
        </p>
      </header>

      <Metronome initialBpm={song.tempo ?? 90} initialTimeSignature={song.timeSignature} labels={dict.metronome} />

      <SongView chordpro={arrangement.chordpro} writtenKey={arrangement.key} labels={dict.song} />

      <Recordings recordings={song.recordings} title={dict.song.recordings} />
    </article>
  );
}
