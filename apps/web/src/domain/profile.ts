import type { ArrangementKind } from "./song";

/** One version a person published, as listed on their profile. */
export interface ProfileVersion {
  readonly songSlug: string;
  readonly songTitle: string;
  readonly artist: string;
  readonly arrangementSlug: string;
  readonly arrangementName: string;
  readonly kind: ArrangementKind;
  readonly key: string;
  readonly createdAt: Date;
}

/** What anyone can see about a person. Never includes the email. */
export interface PublicProfile {
  readonly handle: string;
  readonly name: string;
  readonly image: string | null;
  readonly joinedAt: Date;
  /** Newest first. */
  readonly versions: readonly ProfileVersion[];
}
