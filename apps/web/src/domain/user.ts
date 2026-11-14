/**
 * A signed-in person, as the rest of the app sees them. Sessions, OAuth
 * accounts and tokens stay in the infrastructure layer.
 */
export interface User {
  readonly id: string;
  /** Public alias for the profile URL, unique. Empty only in a stale session. */
  readonly handle: string;
  readonly name: string;
  readonly image: string | null;
}

/** The user performing a use case; passed explicitly, never read from globals. */
export type Actor = Pick<User, "id" | "name">;
