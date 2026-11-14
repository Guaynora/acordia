import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { VersionList } from "@/components/version-list";
import { type Locale, hasLocale } from "@/i18n/config";
import { type Dictionary, getDictionary } from "@/i18n/dictionaries";
import { format } from "@/i18n/format";
import { useCases } from "@/infrastructure/container";

export async function generateMetadata({ params }: PageProps<"/[lang]/u/[handle]">): Promise<Metadata> {
  const { lang, handle } = await params;
  if (!hasLocale(lang)) return {};
  const profile = await useCases.getProfile().execute(handle);
  if (!profile) return { title: (await getDictionary(lang)).profile.notFound };
  return { title: `${profile.name} (@${profile.handle})` };
}

export default async function ProfilePage({ params }: PageProps<"/[lang]/u/[handle]">) {
  const lang = await rootLang();
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <Suspense fallback={<p className="text-muted">{dict.song.loading}</p>}>
      <Content lang={lang} dict={dict} params={params} />
    </Suspense>
  );
}

async function Content({ lang, dict, params }: { lang: Locale; dict: Dictionary; params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await useCases.getProfile().execute(handle);
  if (!profile) notFound();

  const joined = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric" }).format(profile.joinedAt);
  const count = profile.versions.length;

  return (
    <div className="flex flex-col gap-6">
      <header className="card flex items-center gap-5 p-5 sm:p-7">
        <Avatar name={profile.name} image={profile.image} size="lg" />
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-balance">{profile.name}</h1>
          <p className="font-mono text-sm text-muted">@{profile.handle}</p>
          <p className="text-sm text-muted">
            {format(dict.profile.joined, { date: joined })} ·{" "}
            {count === 1 ? dict.profile.versionsOne : format(dict.profile.versions, { count })}
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-semibold">{dict.profile.versionsTitle}</h2>
        {count === 0 ? (
          <p className="card px-6 py-10 text-center text-muted">{dict.profile.empty}</p>
        ) : (
          <VersionList lang={lang} dict={dict} versions={profile.versions} />
        )}
      </section>
    </div>
  );
}
