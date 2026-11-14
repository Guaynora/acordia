import type { RecordingProvider } from "./song";

export interface RecordingReference {
  readonly provider: RecordingProvider;
  readonly externalId: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;

/**
 * Extracts the provider and id from a YouTube or Spotify track link.
 * Returns null for anything else, including Spotify albums and playlists.
 */
export function parseRecordingUrl(input: string): RecordingReference | null {
  const text = input.trim();

  const spotifyUri = /^spotify:track:([A-Za-z0-9]{22})$/.exec(text);
  if (spotifyUri?.[1]) return { provider: "spotify", externalId: spotifyUri[1] };

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return youtube(parts[0]);
  if (host === "youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") return youtube(url.searchParams.get("v"));
    if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") return youtube(parts[1]);
    return null;
  }
  if (host === "open.spotify.com") {
    // Localized links look like /intl-es/track/<id>.
    const rest = parts[0]?.startsWith("intl-") ? parts.slice(1) : parts;
    const trackAt = rest[0] === "embed" ? 1 : 0;
    if (rest[trackAt] === "track") return spotify(rest[trackAt + 1]);
  }
  return null;
}

function youtube(id: string | null | undefined): RecordingReference | null {
  return id && YOUTUBE_ID.test(id) ? { provider: "youtube", externalId: id } : null;
}

function spotify(id: string | undefined): RecordingReference | null {
  return id && SPOTIFY_ID.test(id) ? { provider: "spotify", externalId: id } : null;
}

export function embedUrl(reference: RecordingReference): string {
  return reference.provider === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${reference.externalId}`
    : `https://open.spotify.com/embed/track/${reference.externalId}`;
}

/** What the provider says about a recording, shown next to its player. */
export interface RecordingInfo {
  readonly title: string;
  /** Channel or artist; Spotify does not say. */
  readonly authorName: string | null;
  readonly thumbnailUrl: string | null;
}

export type RecordingLookup =
  | { readonly status: "found"; readonly info: RecordingInfo }
  /** The provider says it does not exist, or it is private. */
  | { readonly status: "missing" }
  /** The provider could not be reached; the link may still be fine. */
  | { readonly status: "unavailable" };

/** Port implemented by the infrastructure layer (oEmbed). */
export interface RecordingInfoProvider {
  lookup(reference: RecordingReference): Promise<RecordingLookup>;
}
