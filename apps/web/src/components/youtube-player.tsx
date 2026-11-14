"use client";

import { useState } from "react";

/**
 * A YouTube video that loads YouTube's player only when pressed. Until then
 * it is just the thumbnail, which keeps the song page light.
 */
export function YouTubePlayer({
  embedUrl,
  thumbnailUrl,
  title,
  playLabel,
}: {
  embedUrl: string;
  thumbnailUrl: string;
  title: string;
  playLabel: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        src={`${embedUrl}?autoplay=1`}
        title={title}
        className="aspect-video w-full rounded-xl border border-border"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={playLabel}
      className="group relative block aspect-video w-full overflow-hidden rounded-xl border border-border bg-surface"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- provider thumbnail, already sized */}
      <img src={thumbnailUrl} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-[1.02]" />
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white transition group-hover:bg-[#ff0033]"
      >
        <svg viewBox="0 0 24 24" className="ml-1 size-6" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </button>
  );
}
