import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UploadForm } from "@/components/upload-form";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
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
      <UploadForm
        action={publishSongAction.bind(null, lang)}
        mode={{ kind: "song" }}
        labels={dict.upload}
        song={dict.song}
        markings={dict.tempoMarkings}
      />
    </div>
  );
}
