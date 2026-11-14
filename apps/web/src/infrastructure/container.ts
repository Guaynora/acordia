import "server-only";
import { AddArrangement } from "@/application/add-arrangement";
import { GetProfile } from "@/application/get-profile";
import { PublishSong } from "@/application/publish-song";
import { GetSong, SearchSongs } from "@/application/queries";
import { getDb } from "./db/client";
import { DrizzleSongRepository } from "./repositories/drizzle-song-repository";
import { DrizzleUserRepository } from "./repositories/drizzle-user-repository";

/**
 * Composition root: the only place that knows which adapter implements each
 * port. Presentation code asks for use cases here and nothing else.
 */
function songRepository() {
  return new DrizzleSongRepository(getDb());
}

function userRepository() {
  return new DrizzleUserRepository(getDb());
}

export const useCases = {
  publishSong: () => new PublishSong(songRepository()),
  addArrangement: () => new AddArrangement(songRepository()),
  searchSongs: () => new SearchSongs(songRepository()),
  getSong: () => new GetSong(songRepository()),
  getProfile: () => new GetProfile(userRepository()),
};
