import type { FavoriteRepository } from "@/domain/favorite-repository";
import type { ProfileVersion } from "@/domain/profile";
import type { SongRepository } from "@/domain/song-repository";
import type { Actor } from "@/domain/user";

export interface VersionRef {
  readonly songSlug: string;
  readonly arrangementSlug: string;
}

/** Saves or unsaves a version for the acting person. */
export class SetFavorite {
  constructor(
    private readonly songs: SongRepository,
    private readonly favorites: FavoriteRepository,
  ) {}

  async execute(ref: VersionRef, favorite: boolean, actor: Actor): Promise<{ readonly ok: boolean }> {
    const song = await this.songs.findBySlug(ref.songSlug);
    const arrangement = song?.arrangements.find((a) => a.slug === ref.arrangementSlug);
    if (!arrangement) return { ok: false };
    if (favorite) await this.favorites.add(actor.id, arrangement.id);
    else await this.favorites.remove(actor.id, arrangement.id);
    return { ok: true };
  }
}

export class IsFavorite {
  constructor(private readonly favorites: FavoriteRepository) {}

  execute(arrangementId: string, actor: Actor): Promise<boolean> {
    return this.favorites.has(actor.id, arrangementId);
  }
}

export class ListFavorites {
  constructor(private readonly favorites: FavoriteRepository) {}

  execute(actor: Actor): Promise<ProfileVersion[]> {
    return this.favorites.list(actor.id);
  }
}
