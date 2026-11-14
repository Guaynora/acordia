import { asc, desc, eq, sql } from "drizzle-orm";
import type { Song, SongSummary } from "@/domain/song";
import type {
  ArrangementChanges,
  NewArrangement,
  NewSong,
  SongMusicChanges,
  SongRepository,
} from "@/domain/song-repository";
import type { Database } from "../db/client";
import { arrangements, recordings, songs, users } from "../db/schema";

export class DrizzleSongRepository implements SongRepository {
  constructor(private readonly db: Database) {}

  async search(query: string, limit: number): Promise<SongSummary[]> {
    const columns = {
      slug: songs.slug,
      title: songs.title,
      artist: songs.artist,
      originalKey: songs.originalKey,
      tempo: songs.tempo,
      timeSignature: songs.timeSignature,
      // Qualified names on purpose: interpolated columns render unqualified,
      // which inside the subquery would bind "id" to arrangements.id.
      arrangementCount: sql<number>`(select count(*)::int from "arrangements" where "arrangements"."song_id" = "songs"."id")`,
    };
    if (query === "") {
      return this.db.select(columns).from(songs).orderBy(desc(songs.createdAt)).limit(limit);
    }
    // Accent-insensitive match on title or artist ("cancion" finds "Canción").
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    return this.db
      .select(columns)
      .from(songs)
      .where(
        sql`unaccent(${songs.title}) ilike unaccent(${pattern}) or unaccent(${songs.artist}) ilike unaccent(${pattern})`,
      )
      .orderBy(asc(songs.title))
      .limit(limit);
  }

  async findBySlug(slug: string): Promise<Song | null> {
    const [song] = await this.db.select().from(songs).where(eq(songs.slug, slug)).limit(1);
    if (!song) return null;
    const [songArrangements, songRecordings] = await Promise.all([
      this.db
        .select({ arrangement: arrangements, authorDisplayName: users.name, authorHandle: users.handle })
        .from(arrangements)
        .leftJoin(users, eq(users.id, arrangements.authorId))
        .where(eq(arrangements.songId, song.id))
        // The first version is the song's reference; on a timestamp tie
        // (rows written in one transaction) the original still comes first.
        .orderBy(asc(arrangements.createdAt), sql`${arrangements.kind} <> 'original'`, asc(arrangements.slug)),
      this.db.select().from(recordings).where(eq(recordings.songId, song.id)).orderBy(asc(recordings.createdAt)),
    ]);
    return {
      id: song.id,
      slug: song.slug,
      title: song.title,
      artist: song.artist,
      originalKey: song.originalKey,
      tempo: song.tempo,
      timeSignature: song.timeSignature,
      arrangements: songArrangements.map(({ arrangement: a, authorDisplayName, authorHandle }) => ({
        id: a.id,
        slug: a.slug,
        name: a.name,
        kind: a.kind,
        description: a.description,
        authorId: a.authorId,
        // The account's current name wins over the legacy free-text credit.
        authorName: authorDisplayName ?? a.authorName,
        authorHandle,
        key: a.key,
        tempo: a.tempo,
        timeSignature: a.timeSignature,
        chordpro: a.chordpro,
        createdAt: a.createdAt,
      })),
      recordings: songRecordings.map((r) => ({
        id: r.id,
        provider: r.provider,
        externalId: r.externalId,
        key: r.key,
      })),
    };
  }

  async slugExists(slug: string): Promise<boolean> {
    const rows = await this.db.select({ id: songs.id }).from(songs).where(eq(songs.slug, slug)).limit(1);
    return rows.length > 0;
  }

  async create(input: NewSong): Promise<Song> {
    const songId = await this.db.transaction(async (tx) => {
      const [song] = await tx
        .insert(songs)
        .values({
          slug: input.slug,
          title: input.title,
          artist: input.artist,
          originalKey: input.originalKey,
          tempo: input.tempo,
          timeSignature: input.timeSignature,
          createdBy: input.createdBy,
        })
        .returning({ id: songs.id });
      if (!song) throw new Error("Song insert returned no row");
      await tx.insert(arrangements).values({ songId: song.id, ...input.arrangement });
      if (input.recordings.length > 0) {
        await tx.insert(recordings).values(input.recordings.map((r) => ({ songId: song.id, addedBy: input.createdBy, ...r })));
      }
      return song.id;
    });
    const created = await this.findBySlug(input.slug);
    if (!created || created.id !== songId) throw new Error("Created song could not be read back");
    return created;
  }

  async addArrangement(songId: string, arrangement: NewArrangement): Promise<void> {
    await this.db.insert(arrangements).values({ songId, ...arrangement });
  }

  async updateArrangement(
    arrangementId: string,
    changes: ArrangementChanges,
    song: { id: string; changes: SongMusicChanges } | null,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(arrangements).set(changes).where(eq(arrangements.id, arrangementId));
      if (song) await tx.update(songs).set(song.changes).where(eq(songs.id, song.id));
    });
  }

  async deleteArrangement(arrangementId: string): Promise<void> {
    await this.db.delete(arrangements).where(eq(arrangements.id, arrangementId));
  }

  async deleteSong(songId: string): Promise<void> {
    // Versions and recordings go with it (ON DELETE CASCADE).
    await this.db.delete(songs).where(eq(songs.id, songId));
  }
}
