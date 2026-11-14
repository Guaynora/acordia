import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lang as rootLang } from "next/root-params";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import type { ProfileVersion } from "@/domain/profile";
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
          <ol className="flex flex-col gap-3">
            {profile.versions.map((version) => (
              <li key={`${version.songSlug}/${version.arrangementSlug}`}>
                <VersionRow lang={lang} dict={dict} version={version} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function VersionRow({ lang, dict, version }: { lang: Locale; dict: Dictionary; version: ProfileVersion }) {
  const base = `/${lang}/songs/${version.songSlug}`;
  // The original version lives at the song URL itself.
  const href = version.arrangementSlug === "original" ? base : `${base}/${version.arrangementSlug}`;

  return (
    <Link
      href={href}
      className="card flex items-center gap-4 p-4 transition hover:border-border-strong hover:shadow-elevated sm:p-5"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft font-mono text-lg font-bold text-accent">
        {version.key}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-semibold">{version.songTitle}</p>
        <p className="truncate text-sm text-muted">
          {version.artist} · {version.arrangementName}
          {version.kind !== "original" && ` (${dict.song.kinds[version.kind]})`}
        </p>
      </div>
    </Link>
  );
}
