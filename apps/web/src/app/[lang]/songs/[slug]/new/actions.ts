"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/components/upload-form";
import { hasLocale } from "@/i18n/config";
import { useCases } from "@/infrastructure/container";

const text = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export async function addVersionAction(
  lang: string,
  songSlug: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  let target: string;
  try {
    const result = await useCases.addArrangement().execute({
      songSlug,
      name: text(form, "name"),
      kind: text(form, "kind"),
      description: text(form, "description"),
      authorName: text(form, "authorName"),
      key: text(form, "key"),
      tempo: text(form, "tempo"),
      timeSignature: text(form, "timeSignature"),
      source: text(form, "source"),
    });
    if (!result.ok) return { errors: result.errors, unexpected: false };
    target = `/songs/${result.songSlug}/${result.arrangementSlug}`;
  } catch (error) {
    console.error("addVersionAction failed", error);
    return { errors: [], unexpected: true };
  }
  redirect(`/${hasLocale(lang) ? lang : "es"}${target}`);
}
