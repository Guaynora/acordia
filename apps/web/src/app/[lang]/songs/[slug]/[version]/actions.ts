"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/upload-form";
import { hasLocale } from "@/i18n/config";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { useCases } from "@/infrastructure/container";
import { loginPath } from "../../../return-path";

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

/** URL of a version: the song's first one lives at the song URL itself. */
function versionPath(lang: string, songSlug: string, arrangementSlug: string, main: boolean) {
  return main ? `/${lang}/songs/${songSlug}` : `/${lang}/songs/${songSlug}/${arrangementSlug}`;
}

export async function editVersionAction(
  lang: string,
  songSlug: string,
  arrangementSlug: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const locale = hasLocale(lang) ? lang : "es";
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/songs/${songSlug}/${arrangementSlug}/edit`));

  let target: string;
  try {
    const result = await useCases.editArrangement().execute(
      {
        songSlug,
        arrangementSlug,
        name: text(form, "name"),
        kind: text(form, "kind"),
        description: text(form, "description"),
        key: text(form, "key"),
        tempo: text(form, "tempo"),
        timeSignature: text(form, "timeSignature"),
        source: text(form, "source"),
      },
      user,
    );
    if (!result.ok) return { errors: result.errors, unexpected: false };
    target = versionPath(locale, result.songSlug, result.arrangementSlug, result.main);
  } catch (error) {
    console.error("editVersionAction failed", error);
    return { errors: [], unexpected: true };
  }
  redirect(target);
}

export async function deleteVersionAction(lang: string, songSlug: string, arrangementSlug: string): Promise<void> {
  const locale = hasLocale(lang) ? lang : "es";
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/songs/${songSlug}`));

  const result = await useCases.deleteArrangement().execute({ songSlug, arrangementSlug }, user);
  // The buttons only show when deleting is allowed, so a refusal here means
  // the page was stale or the request was forged: go back to the song.
  if (!result.ok) redirect(`/${locale}/songs/${songSlug}`);
  redirect(result.songDeleted ? `/${locale}` : `/${locale}/songs/${result.songSlug}`);
}
