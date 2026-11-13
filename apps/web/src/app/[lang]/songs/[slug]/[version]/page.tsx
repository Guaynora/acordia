import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { SongPageContent } from "@/components/song-page";
import { type Locale, hasLocale } from "@/i18n/config";
import { type Dictionary, getDictionary } from "@/i18n/dictionaries";

export default async function SongVersionPage({ params }: PageProps<"/[lang]/songs/[slug]/[version]">) {
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
  return <SongPageContent lang={lang} dict={dict} slug={slug} versionSlug={version} />;
}
