import Link from "next/link";
import { setFavoriteAction } from "@/app/[lang]/songs/[slug]/[version]/actions";
import { loginPath } from "@/app/[lang]/return-path";
import type { Arrangement, Song } from "@/domain/song";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { useCases } from "@/infrastructure/container";

/** Save/unsave toggle for a version. Reads the session: render inside <Suspense>. */
export async function FavoriteButton({
  lang,
  dict,
  song,
  current,
}: {
  lang: Locale;
  dict: Dictionary;
  song: Song;
  current: Arrangement;
}) {
  const user = await getCurrentUser();
  const className = "btn-secondary min-h-9 gap-1.5 px-3 text-sm";

  if (!user) {
    return (
      <Link
        href={loginPath(lang, `/${lang}/songs/${song.slug}/${current.slug}`)}
        className={className}
        title={dict.favorites.saveHint}
      >
        <Star filled={false} /> {dict.favorites.save}
      </Link>
    );
  }

  const saved = await useCases.isFavorite().execute(current.id, user);
  return (
    <form action={setFavoriteAction.bind(null, lang, song.slug, current.slug, !saved)}>
      <button
        type="submit"
        aria-pressed={saved}
        title={saved ? dict.favorites.unsaveHint : dict.favorites.saveHint}
        className={`${className} ${saved ? "border-accent text-accent" : ""}`}
      >
        <Star filled={saved} /> {saved ? dict.favorites.saved : dict.favorites.save}
      </button>
    </form>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />
    </svg>
  );
}
