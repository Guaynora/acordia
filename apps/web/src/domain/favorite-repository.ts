import type { ProfileVersion } from "./profile";

/** Port implemented by the infrastructure layer. */
export interface FavoriteRepository {
  /** Saving twice is harmless. */
  add(userId: string, arrangementId: string): Promise<void>;
  remove(userId: string, arrangementId: string): Promise<void>;
  has(userId: string, arrangementId: string): Promise<boolean>;
  /** Newest saved first. */
  list(userId: string): Promise<ProfileVersion[]>;
}
