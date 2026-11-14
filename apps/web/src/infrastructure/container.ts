import "server-only";
import { AddArrangement } from "@/application/add-arrangement";
import { AddRecording } from "@/application/add-recording";
import { DeleteArrangement } from "@/application/delete-arrangement";
import { EditArrangement } from "@/application/edit-arrangement";
import { IsFavorite, ListFavorites, SetFavorite } from "@/application/favorites";
import { GetProfile } from "@/application/get-profile";
import { PublishSong } from "@/application/publish-song";
import { GetSong, SearchSongs } from "@/application/queries";
import { getDb } from "./db/client";
import { OEmbedRecordingInfo } from "./oembed/oembed-recording-info";
import { DrizzleFavoriteRepository } from "./repositories/drizzle-favorite-repository";
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

function favoriteRepository() {
  return new DrizzleFavoriteRepository(getDb());
}

export const useCases = {
  publishSong: () => new PublishSong(songRepository(), new OEmbedRecordingInfo()),
  addArrangement: () => new AddArrangement(songRepository()),
  editArrangement: () => new EditArrangement(songRepository()),
  deleteArrangement: () => new DeleteArrangement(songRepository()),
  searchSongs: () => new SearchSongs(songRepository()),
  getSong: () => new GetSong(songRepository()),
  getProfile: () => new GetProfile(userRepository()),
  setFavorite: () => new SetFavorite(songRepository(), favoriteRepository()),
  isFavorite: () => new IsFavorite(favoriteRepository()),
  listFavorites: () => new ListFavorites(favoriteRepository()),
  addRecording: () => new AddRecording(songRepository(), new OEmbedRecordingInfo()),
};
