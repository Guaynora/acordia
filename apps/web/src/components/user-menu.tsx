import Link from "next/link";
import { signOut } from "@/app/[lang]/auth-actions";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { Avatar } from "./avatar";

/** Header account control. Reads the session: render it inside <Suspense>. */
export async function UserMenu({ lang, labels }: { lang: Locale; labels: Dictionary["nav"] }) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href={`/${lang}/login`} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface hover:text-foreground">
        {labels.signIn}
      </Link>
    );
  }

  return (
    <details className="relative">
      <summary
        aria-label={labels.account}
        className="flex cursor-pointer list-none items-center rounded-full p-0.5 hover:bg-surface [&::-webkit-details-marker]:hidden"
      >
        <Avatar name={user.name} image={user.image} />
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-lg">
        <p className="truncate px-3 py-2 text-sm font-semibold">{user.name}</p>
        {user.handle && (
          <Link
            href={`/${lang}/u/${user.handle}`}
            className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface hover:text-foreground"
          >
            {labels.profile}
          </Link>
        )}
        <form action={signOut.bind(null, lang)}>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface hover:text-foreground"
          >
            {labels.signOut}
          </button>
        </form>
      </div>
    </details>
  );
}
