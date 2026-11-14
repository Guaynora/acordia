import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { VersionList } from "@/components/version-list";
import { type Locale, hasLocale } from "@/i18n/config";
import { type Dictionary, getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { useCases } from "@/infrastructure/container";
import { loginPath } from "../return-path";

export async function generateMetadata({ params }: PageProps<"/[lang]/favorites">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  return { title: (await getDictionary(lang)).favorites.title, robots: { index: false } };
}

export default async function FavoritesPage() {
  const lang = await rootLang();
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="flex flex-col gap-6">
      <header className="max-w-3xl space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{dict.favorites.title}</h1>
        <p className="text-muted sm:text-lg">{dict.favorites.subtitle}</p>
      </header>
      <Suspense fallback={<p className="text-muted">{dict.song.loading}</p>}>
        <Favorites lang={lang} dict={dict} />
      </Suspense>
    </div>
  );
}

async function Favorites({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(lang, `/${lang}/favorites`));

  const favorites = await useCases.listFavorites().execute(user);
  if (favorites.length === 0) {
    return <p className="card px-6 py-10 text-center text-muted">{dict.favorites.empty}</p>;
  }
  return <VersionList lang={lang} dict={dict} versions={favorites} />;
}
