import { notFound, redirect } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { UploadForm } from "@/components/upload-form";
import { type Locale, hasLocale } from "@/i18n/config";
import { type Dictionary, getDictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { useCases } from "@/infrastructure/container";
import { loginPath } from "../../../return-path";
import { addVersionAction } from "./actions";

export default async function NewVersionPage({ params }: PageProps<"/[lang]/songs/[slug]/new">) {
  const lang = await rootLang();
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <Suspense fallback={<p className="text-muted">{dict.song.loading}</p>}>
      <Content lang={lang} dict={dict} params={params} />
    </Suspense>
  );
}

async function Content({ lang, dict, params }: { lang: Locale; dict: Dictionary; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [user, song] = await Promise.all([getCurrentUser(), useCases.getSong().execute(slug)]);
  if (!song) notFound();
  if (!user) redirect(loginPath(lang, `/${lang}/songs/${song.slug}/new`));

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {format(dict.upload.versionTitle, { title: song.title })}
        </h1>
        <p className="text-muted sm:text-lg">{format(dict.upload.versionSubtitle, { title: song.title })}</p>
      </header>
      <UploadForm
        action={addVersionAction.bind(null, lang, song.slug)}
        mode={{
          kind: "version",
          song: { title: song.title, artist: song.artist, tempo: song.tempo, timeSignature: song.timeSignature },
        }}
        labels={dict.upload}
        song={dict.song}
        markings={dict.tempoMarkings}
        publisher={user.name}
      />
    </div>
  );
}
