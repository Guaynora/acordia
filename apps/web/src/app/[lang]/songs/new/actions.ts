"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/upload-form";
import { hasLocale } from "@/i18n/config";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { useCases } from "@/infrastructure/container";
import { loginPath } from "../../return-path";

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export async function publishSongAction(lang: string, _previous: FormState, form: FormData): Promise<FormState> {
  const locale = hasLocale(lang) ? lang : "es";
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/songs/new`));

  let slug: string;
  try {
    const result = await useCases.publishSong().execute({
      title: text(form, "title"),
      artist: text(form, "artist"),
      key: text(form, "key"),
      tempo: text(form, "tempo"),
      timeSignature: text(form, "timeSignature"),
      source: text(form, "source"),
      recordingUrls: text(form, "recordings").split("\n"),
    }, user);
    if (!result.ok) return { errors: result.errors, unexpected: false };
    slug = result.slug;
  } catch (error) {
    console.error("publishSongAction failed", error);
    return { errors: [], unexpected: true };
  }
  redirect(`/${locale}/songs/${slug}`);
}
