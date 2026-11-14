"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/infrastructure/auth/auth";
import { safeReturnPath } from "./return-path";

/** Starts Google sign-in and comes back to `next` (a path on this site). */
export async function signInWithGoogle(next: string): Promise<void> {
  const { url } = await getAuth().api.signInSocial({
    body: { provider: "google", callbackURL: safeReturnPath(next) },
    headers: await headers(),
  });
  if (!url) throw new Error("Google sign-in did not return a redirect URL");
  redirect(url);
}

export async function signOut(lang: string): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect(`/${lang === "en" ? "en" : "es"}`);
}
