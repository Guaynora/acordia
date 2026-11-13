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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{dict.upload.title}</h1>
      <UploadForm action={publishSongAction.bind(null, lang)} labels={dict.upload} sections={dict.song.sections} />
    </div>
  );
}
