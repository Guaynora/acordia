import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { Metronome } from "@/components/metronome";
import { Recordings } from "@/components/recordings";
import { SongView } from "@/components/song-view";
import { tempoMarking } from "@/domain/tempo";
import { hasLocale } from "@/i18n/config";
import { type Dictionary, getDictionary } from "@/i18n/dictionaries";
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
    <article className="flex flex-col gap-6">
      <header className="card flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">{song.title}</h1>
          <p className="text-muted">
            {dict.song.by} <span className="font-semibold text-foreground">{song.artist}</span>
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
          <Stat label={dict.song.key} value={song.originalKey} accent />
          <Stat
            label={dict.song.tempoLabel}
            value={song.tempo !== null ? `${song.tempo}` : "—"}
            unit={song.tempo !== null ? "BPM" : undefined}
            note={song.tempo !== null ? dict.tempoMarkings[tempoMarking(song.tempo)].split(" · ")[0] : dict.song.noTempo}
          />
          <Stat label={dict.song.timeSignatureLabel} value={song.timeSignature} />
        </dl>
      </header>

      <SongView
        chordpro={arrangement.chordpro}
        writtenKey={arrangement.key}
        labels={dict.song}
        aside={
          <>
            <Metronome
              songBpm={song.tempo}
              songTimeSignature={song.timeSignature}
              labels={dict.metronome}
              markings={dict.tempoMarkings}
            />
            <Recordings recordings={song.recordings} title={dict.song.recordings} />
          </>
        }
      />
    </article>
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
