import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { UploadForm } from "@/components/upload-form";
import { canManageArrangement } from "@/domain/permissions";
import { type Locale, hasLocale } from "@/i18n/config";
import { type Dictionary, getDictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { useCases } from "@/infrastructure/container";
import { loginPath } from "../../../../return-path";
import { editVersionAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

export default async function EditVersionPage({ params }: PageProps<"/[lang]/songs/[slug]/[version]/edit">) {
  const lang = await rootLang();
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <Suspense fallback={<p className="text-muted">{dict.song.loading}</p>}>
      <Content lang={lang} dict={dict} params={params} />
    </Suspense>
  );
}

async function Content({
  lang,
  dict,
  params,
}: {
  lang: Locale;
  dict: Dictionary;
  params: Promise<{ slug: string; version: string }>;
}) {
  const { slug, version } = await params;
  const [user, song] = await Promise.all([getCurrentUser(), useCases.getSong().execute(slug)]);
  const index = song?.arrangements.findIndex((a) => a.slug === version) ?? -1;
  const arrangement = song?.arrangements[index];
  if (!song || !arrangement) notFound();
  if (!user) redirect(loginPath(lang, `/${lang}/songs/${song.slug}/${arrangement.slug}/edit`));

  if (!canManageArrangement(user, arrangement)) {
    return <p className="card px-6 py-10 text-center text-muted">{dict.upload.errors.forbidden}</p>;
  }

  const main = index === 0;
  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {format(dict.upload.editTitle, { name: main ? song.title : arrangement.name })}
        </h1>
        <p className="text-muted sm:text-lg">{format(dict.upload.editSubtitle, { title: song.title })}</p>
      </header>
      <UploadForm
        action={editVersionAction.bind(null, lang, song.slug, arrangement.slug)}
        mode={{
          kind: "edit",
          main,
          song: { title: song.title, artist: song.artist, tempo: song.tempo, timeSignature: song.timeSignature },
        }}
        initial={{
          name: arrangement.name,
          kind: arrangement.kind,
          description: arrangement.description ?? "",
          key: arrangement.key,
          // The first version shows the song's own tempo and meter.
          tempo: String((main ? song.tempo : arrangement.tempo) ?? ""),
          timeSignature: (main ? song.timeSignature : arrangement.timeSignature) ?? "",
          source: arrangement.chordpro,
        }}
        labels={dict.upload}
        song={dict.song}
        markings={dict.tempoMarkings}
        publisher={user.name}
      />
    </div>
  );
}
