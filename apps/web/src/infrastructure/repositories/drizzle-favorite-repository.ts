import { and, desc, eq } from "drizzle-orm";
import type { FavoriteRepository } from "@/domain/favorite-repository";
import type { ProfileVersion } from "@/domain/profile";
import type { Database } from "../db/client";
import { arrangements, favorites, songs } from "../db/schema";

export class DrizzleFavoriteRepository implements FavoriteRepository {
  constructor(private readonly db: Database) {}

  async add(userId: string, arrangementId: string): Promise<void> {
    await this.db.insert(favorites).values({ userId, arrangementId }).onConflictDoNothing();
  }

  async remove(userId: string, arrangementId: string): Promise<void> {
    await this.db
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.arrangementId, arrangementId)));
  }

  async has(userId: string, arrangementId: string): Promise<boolean> {
    const rows = await this.db
      .select({ userId: favorites.userId })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.arrangementId, arrangementId)))
      .limit(1);
    return rows.length > 0;
  }

  list(userId: string): Promise<ProfileVersion[]> {
    return this.db
      .select({
        songSlug: songs.slug,
        songTitle: songs.title,
        artist: songs.artist,
        arrangementSlug: arrangements.slug,
        arrangementName: arrangements.name,
        kind: arrangements.kind,
        key: arrangements.key,
        createdAt: favorites.createdAt,
      })
      .from(favorites)
      .innerJoin(arrangements, eq(arrangements.id, favorites.arrangementId))
      .innerJoin(songs, eq(songs.id, arrangements.songId))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));
  }
}
