import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { Metronome } from "@/components/metronome";
import { tempoMarking } from "@/domain/tempo";
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
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{song.title}</h1>
          <p className="text-muted">
            {dict.song.by} {song.artist}
          </p>
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-muted">{dict.song.key}</dt>
            <dd className="text-lg font-semibold">{song.originalKey}</dd>
          </div>
          <div>
            <dt className="text-muted">{dict.song.tempoLabel}</dt>
            <dd className="text-lg font-semibold">
              {song.tempo !== null ? (
                <>
                  {format(dict.song.tempo, { bpm: song.tempo })}{" "}
                  <span className="text-sm font-normal text-muted">{dict.tempoMarkings[tempoMarking(song.tempo)]}</span>
                </>
              ) : (
                <span className="text-sm font-normal text-muted">{dict.song.noTempo}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted">{dict.song.timeSignatureLabel}</dt>
            <dd className="text-lg font-semibold">{song.timeSignature}</dd>
          </div>
        </dl>
      </header>

      <Metronome
        songBpm={song.tempo}
        songTimeSignature={song.timeSignature}
        labels={dict.metronome}
        markings={dict.tempoMarkings}
      />

      <SongView chordpro={arrangement.chordpro} writtenKey={arrangement.key} labels={dict.song} />

      <Recordings recordings={song.recordings} title={dict.song.recordings} />
    </article>
  );
}
