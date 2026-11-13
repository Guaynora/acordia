import { describe, expect, it } from "vitest";
import { embedUrl, parseRecordingUrl } from "@/domain/recording-url";
import { slugify } from "@/domain/slug";
import { negotiateLocale } from "@/i18n/config";

describe("parseRecordingUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "youtube", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "youtube", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
    ["https://music.youtube.com/watch?v=dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "youtube", "dQw4w9WgXcQ"],
    ["https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC", "spotify", "4uLU6hMCjMI75M1A2tKUQC"],
    ["https://open.spotify.com/intl-es/track/4uLU6hMCjMI75M1A2tKUQC?si=x", "spotify", "4uLU6hMCjMI75M1A2tKUQC"],
    ["spotify:track:4uLU6hMCjMI75M1A2tKUQC", "spotify", "4uLU6hMCjMI75M1A2tKUQC"],
  ])("parses %s", (url, provider, externalId) => {
    expect(parseRecordingUrl(url)).toEqual({ provider, externalId });
  });

  it.each([
    "https://open.spotify.com/album/4uLU6hMCjMI75M1A2tKUQC",
    "https://www.youtube.com/watch?v=short",
    "https://vimeo.com/123",
    "not a url",
  ])("rejects %s", (url) => {
    expect(parseRecordingUrl(url)).toBeNull();
  });

  it("builds privacy-friendly embed URLs", () => {
    expect(embedUrl({ provider: "youtube", externalId: "dQw4w9WgXcQ" })).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
});

describe("slugify", () => {
  it("strips accents and punctuation", () => {
    expect(slugify("¿Canción Bonita?", "Él & Ella")).toBe("cancion-bonita-el-ella");
  });
});

describe("negotiateLocale", () => {
  it.each([
    ["en-US,en;q=0.9,es;q=0.8", "en"],
    ["es-CL,es;q=0.9", "es"],
    ["fr-FR,en;q=0.5", "en"],
    ["de-DE", "es"],
    [null, "es"],
  ] as const)("%s -> %s", (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });
});
