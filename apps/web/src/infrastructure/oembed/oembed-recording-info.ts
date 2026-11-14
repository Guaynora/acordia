import type { RecordingInfo, RecordingInfoProvider, RecordingLookup, RecordingReference } from "@/domain/recording-url";

const TIMEOUT_MS = 4000;

/** Hosts whose images we are willing to show; anything else is dropped. */
const THUMBNAIL_HOSTS = [/^i\.ytimg\.com$/, /^i\d?\.ytimg\.com$/, /^i\.scdn\.co$/, /(^|\.)spotifycdn\.com$/];

function endpoint({ provider, externalId }: RecordingReference): string {
  const page =
    provider === "youtube"
      ? `https://www.youtube.com/watch?v=${externalId}`
      : `https://open.spotify.com/track/${externalId}`;
  const base = provider === "youtube" ? "https://www.youtube.com/oembed?format=json&url=" : "https://open.spotify.com/oembed?url=";
  return base + encodeURIComponent(page);
}

/**
 * Reads title, channel and thumbnail from the providers' public oEmbed
 * endpoints. Only the video or track id is sent. Never throws: a provider
 * that is down or slow reports "unavailable", so publishing still works.
 */
export class OEmbedRecordingInfo implements RecordingInfoProvider {
  async lookup(reference: RecordingReference): Promise<RecordingLookup> {
    let response: Response;
    try {
      response = await fetch(endpoint(reference), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: "application/json" },
      });
    } catch {
      return { status: "unavailable" };
    }
    // YouTube answers 404 for removed videos and 401/403 for private ones.
    if ([400, 401, 403, 404].includes(response.status)) return { status: "missing" };
    if (!response.ok) return { status: "unavailable" };
    try {
      const info = parseInfo(await response.json());
      return info ? { status: "found", info } : { status: "unavailable" };
    } catch {
      return { status: "unavailable" };
    }
  }
}

function parseInfo(data: unknown): RecordingInfo | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  const title = text(record.title, 200);
  if (!title) return null;
  return { title, authorName: text(record.author_name, 120), thumbnailUrl: thumbnail(record.thumbnail_url) };
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

/** Only https images from the providers' own image hosts. */
export function thumbnail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !THUMBNAIL_HOSTS.some((host) => host.test(url.hostname))) return null;
    return url.toString();
  } catch {
    return null;
  }
}
