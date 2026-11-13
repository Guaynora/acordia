import "server-only";
import { PublishSong } from "@/application/publish-song";
import { GetSong, SearchSongs } from "@/application/queries";
import { getDb } from "./db/client";
import { DrizzleSongRepository } from "./repositories/drizzle-song-repository";

/**
 * Composition root: the only place that knows which adapter implements each
 * port. Presentation code asks for use cases here and nothing else.
 */
function songRepository() {
  return new DrizzleSongRepository(getDb());
}

export const useCases = {
  publishSong: () => new PublishSong(songRepository()),
  searchSongs: () => new SearchSongs(songRepository()),
  getSong: () => new GetSong(songRepository()),
};
