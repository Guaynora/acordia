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

export async function addVersionAction(
  lang: string,
  songSlug: string,
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const locale = hasLocale(lang) ? lang : "es";
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/songs/${songSlug}/new`));

  let target: string;
  try {
    const result = await useCases.addArrangement().execute({
      songSlug,
      name: text(form, "name"),
      kind: text(form, "kind"),
      description: text(form, "description"),
      key: text(form, "key"),
      tempo: text(form, "tempo"),
      timeSignature: text(form, "timeSignature"),
      source: text(form, "source"),
    }, user);
    if (!result.ok) return { errors: result.errors, unexpected: false };
    target = `/songs/${result.songSlug}/${result.arrangementSlug}`;
  } catch (error) {
    console.error("addVersionAction failed", error);
    return { errors: [], unexpected: true };
  }
  redirect(`/${locale}${target}`);
}
