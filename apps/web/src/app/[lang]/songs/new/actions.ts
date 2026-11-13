"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/upload-form";
import { hasLocale } from "@/i18n/config";
import { useCases } from "@/infrastructure/container";

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export async function publishSongAction(lang: string, _previous: FormState, form: FormData): Promise<FormState> {
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
      authorName: text(form, "authorName"),
    });
    if (!result.ok) return { errors: result.errors, unexpected: false };
    slug = result.slug;
  } catch (error) {
    console.error("publishSongAction failed", error);
    return { errors: [], unexpected: true };
  }
  redirect(`/${hasLocale(lang) ? lang : "es"}/songs/${slug}`);
}
