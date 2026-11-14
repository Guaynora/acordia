"use server";

import { refresh } from "next/cache";
import type { InputErrorCode } from "@/application/song-input";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { useCases } from "@/infrastructure/container";

export type AddRecordingActionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: InputErrorCode | "login" | "unexpected" };

/** Links a YouTube video or Spotify track to a song; needs an account. */
export async function addRecordingAction(songSlug: string, url: string): Promise<AddRecordingActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, code: "login" };
  try {
    const result = await useCases.addRecording().execute({ songSlug, url }, user);
    if (!result.ok) return { ok: false, code: result.errors[0]?.code ?? "unexpected" };
  } catch (error) {
    console.error("addRecordingAction failed", error);
    return { ok: false, code: "unexpected" };
  }
  refresh();
  return { ok: true };
}
