import { canManageArrangement } from "@/domain/permissions";
import type { SongRepository } from "@/domain/song-repository";
import type { Actor } from "@/domain/user";
import type { InputError } from "./song-input";

export type DeleteArrangementResult =
  | { readonly ok: true; readonly songSlug: string; readonly songDeleted: boolean }
  | { readonly ok: false; readonly errors: readonly InputError[] };

/**
 * Removes a version. The song's first version is its reference (key, tempo,
 * the song URL), so it can only go when it is the last one left, and then
 * the whole song goes with it.
 */
export class DeleteArrangement {
  constructor(private readonly songs: SongRepository) {}

  async execute(input: { songSlug: string; arrangementSlug: string }, actor: Actor): Promise<DeleteArrangementResult> {
    const song = await this.songs.findBySlug(input.songSlug);
    const index = song?.arrangements.findIndex((a) => a.slug === input.arrangementSlug) ?? -1;
    const arrangement = song?.arrangements[index];
    if (!song || !arrangement) return { ok: false, errors: [{ field: "song", code: "not_found" }] };
    if (!canManageArrangement(actor, arrangement)) return { ok: false, errors: [{ field: "song", code: "forbidden" }] };

    if (index > 0) {
      await this.songs.deleteArrangement(arrangement.id);
      return { ok: true, songSlug: song.slug, songDeleted: false };
    }
    if (song.arrangements.length > 1) {
      return { ok: false, errors: [{ field: "song", code: "original_has_versions" }] };
    }
    await this.songs.deleteSong(song.id);
    return { ok: true, songSlug: song.slug, songDeleted: true };
  }
}
