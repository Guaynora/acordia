import type { PublicProfile } from "./profile";

/** Port implemented by the infrastructure layer. */
export interface UserRepository {
  findProfile(handle: string): Promise<PublicProfile | null>;
  handleExists(handle: string): Promise<boolean>;
}
