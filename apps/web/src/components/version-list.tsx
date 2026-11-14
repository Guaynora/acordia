import Link from "next/link";
import type { ProfileVersion } from "@/domain/profile";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/** Versions as linked cards: on a profile, in favorites. */
export function VersionList({
  lang,
  dict,
  versions,
}: {
  lang: Locale;
  dict: Dictionary;
  versions: readonly ProfileVersion[];
}) {
  return (
    <ol className="flex flex-col gap-3">
      {versions.map((version) => (
        <li key={`${version.songSlug}/${version.arrangementSlug}`}>
          <VersionRow lang={lang} dict={dict} version={version} />
        </li>
      ))}
    </ol>
  );
}

function VersionRow({ lang, dict, version }: { lang: Locale; dict: Dictionary; version: ProfileVersion }) {
  const base = `/${lang}/songs/${version.songSlug}`;
  // The original version lives at the song URL itself.
  const href = version.kind === "original" ? base : `${base}/${version.arrangementSlug}`;

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
