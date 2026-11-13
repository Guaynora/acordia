import type { Song, SongSummary } from "@/domain/song";
import type { SongRepository } from "@/domain/song-repository";

export class SearchSongs {
  constructor(private readonly songs: SongRepository) {}

  execute(query: string, limit = 50): Promise<SongSummary[]> {
    return this.songs.search(query.trim().slice(0, 100), limit);
  }
}

export class GetSong {
  constructor(private readonly songs: SongRepository) {}

  execute(slug: string): Promise<Song | null> {
    return this.songs.findBySlug(slug);
  }
}
