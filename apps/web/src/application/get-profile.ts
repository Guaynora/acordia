import type { PublicProfile } from "@/domain/profile";
import type { UserRepository } from "@/domain/user-repository";

export class GetProfile {
  constructor(private readonly users: UserRepository) {}

  execute(handle: string): Promise<PublicProfile | null> {
    // Handles are stored lowercase; accept /u/Jonathan-Guaynora too.
    return this.users.findProfile(handle.trim().toLowerCase());
  }
}
