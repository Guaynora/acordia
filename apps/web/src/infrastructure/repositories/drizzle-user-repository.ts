import { desc, eq } from "drizzle-orm";
import type { PublicProfile } from "@/domain/profile";
import type { UserRepository } from "@/domain/user-repository";
import type { Database } from "../db/client";
import { arrangements, songs, users } from "../db/schema";

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findProfile(handle: string): Promise<PublicProfile | null> {
    const [user] = await this.db
      .select({ id: users.id, handle: users.handle, name: users.name, image: users.image, joinedAt: users.createdAt })
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1);
    if (!user) return null;
    const { id, ...profile } = user;

    const versions = await this.db
      .select({
        songSlug: songs.slug,
        songTitle: songs.title,
        artist: songs.artist,
        arrangementSlug: arrangements.slug,
        arrangementName: arrangements.name,
        kind: arrangements.kind,
        key: arrangements.key,
        createdAt: arrangements.createdAt,
      })
      .from(arrangements)
      .innerJoin(songs, eq(songs.id, arrangements.songId))
      .where(eq(arrangements.authorId, id))
      .orderBy(desc(arrangements.createdAt));

    return { ...profile, versions };
  }

  async handleExists(handle: string): Promise<boolean> {
    const rows = await this.db.select({ id: users.id }).from(users).where(eq(users.handle, handle)).limit(1);
    return rows.length > 0;
  }
}
