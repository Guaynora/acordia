import type { Arrangement } from "./song";
import type { Actor } from "./user";

/** Moderators and admins can fix or remove anyone's content. */
export function isModerator(actor: Actor): boolean {
  return actor.role === "moderator" || actor.role === "admin";
}

/**
 * Who may edit or delete a version: its author, or a moderator. Versions
 * from before accounts have no author, so only moderators can touch them.
 */
export function canManageArrangement(actor: Actor, arrangement: Pick<Arrangement, "authorId">): boolean {
  return isModerator(actor) || (arrangement.authorId !== null && arrangement.authorId === actor.id);
}
