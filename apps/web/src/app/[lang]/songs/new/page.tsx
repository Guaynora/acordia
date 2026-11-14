import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { UploadForm } from "@/components/upload-form";
import { type Locale, hasLocale } from "@/i18n/config";
import { type Dictionary, getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { loginPath } from "../../return-path";
import { publishSongAction } from "./actions";

export async function generateMetadata({ params }: PageProps<"/[lang]/songs/new">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).upload.title };
}

export default async function NewSongPage({ params }: PageProps<"/[lang]/songs/new">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{dict.upload.title}</h1>
        <p className="text-muted sm:text-lg">{dict.upload.subtitle}</p>
      </header>
      <Suspense fallback={<p className="text-muted">{dict.song.loading}</p>}>
        <SongForm lang={lang} dict={dict} />
      </Suspense>
    </div>
  );
}

/** Reads the session, so it streams in behind the boundary above. */
async function SongForm({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(lang, `/${lang}/songs/new`));

  return (
    <UploadForm
      action={publishSongAction.bind(null, lang)}
      mode={{ kind: "song" }}
      labels={dict.upload}
      song={dict.song}
      markings={dict.tempoMarkings}
      publisher={user.name}
    />
  );
}
