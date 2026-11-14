import Link from "next/link";
import { deleteVersionAction } from "@/app/[lang]/songs/[slug]/[version]/actions";
import { canManageArrangement } from "@/domain/permissions";
import type { Arrangement, Song } from "@/domain/song";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/infrastructure/auth/current-user";

/**
 * Edit and delete controls, shown only to people allowed to use them. Reads
 * the session: render inside its own <Suspense> so the chords don't wait.
 */
export async function VersionActions({
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
  if (!user || !canManageArrangement(user, current)) return null;

  const main = song.arrangements[0]?.id === current.id;
  const onlyVersion = song.arrangements.length === 1;
  const canDelete = !main || onlyVersion;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/${lang}/songs/${song.slug}/${current.slug}/edit`}
        className="btn-secondary min-h-9 px-3 text-sm"
      >
        {dict.song.editVersion}
      </Link>
      {canDelete ? (
        <details className="group">
          <summary className="btn-secondary min-h-9 cursor-pointer list-none px-3 text-sm text-danger [&::-webkit-details-marker]:hidden">
            {dict.song.deleteVersion}
          </summary>
          <form
            action={deleteVersionAction.bind(null, lang, song.slug, current.slug)}
            className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm"
          >
            <span>{onlyVersion ? dict.song.deleteSongConfirm : dict.song.deleteConfirm}</span>
            <button type="submit" className="rounded-lg bg-danger px-3 py-1.5 font-semibold text-background hover:opacity-90">
              {dict.song.deleteYes}
            </button>
          </form>
        </details>
      ) : (
        <span className="text-xs text-muted">{dict.song.cannotDeleteOriginal}</span>
      )}
    </div>
  );
}
