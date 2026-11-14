import { describe, expect, it } from "vitest";
import { thumbnail } from "@/infrastructure/oembed/oembed-recording-info";

describe("thumbnail", () => {
  it("keeps https images from YouTube and Spotify image hosts", () => {
    expect(thumbnail("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(thumbnail("https://image-cdn-ak.spotifycdn.com/image/ab67")).toBe("https://image-cdn-ak.spotifycdn.com/image/ab67");
    expect(thumbnail("https://i.scdn.co/image/ab67")).toBe("https://i.scdn.co/image/ab67");
  });

  it("drops anything else", () => {
    expect(thumbnail("http://i.ytimg.com/vi/x/hqdefault.jpg")).toBeNull();
    expect(thumbnail("https://evil.example/i.ytimg.com.jpg")).toBeNull();
    expect(thumbnail("https://i.ytimg.com.evil.example/x.jpg")).toBeNull();
    expect(thumbnail("javascript:alert(1)")).toBeNull();
    expect(thumbnail(42)).toBeNull();
  });
});
