import { embedUrl } from "@/domain/recording-url";
import type { Recording } from "@/domain/song";

/** Official provider players; we embed and never host audio. */
export function Recordings({ recordings, title }: { recordings: readonly Recording[]; title: string }) {
  if (recordings.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      <div className="grid gap-4">
        {recordings.map((recording) =>
          recording.provider === "youtube" ? (
            <iframe
              key={recording.id}
              src={embedUrl(recording)}
              title={`YouTube ${recording.externalId}`}
              className="aspect-video w-full rounded-xl border border-border"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <iframe
              key={recording.id}
              src={embedUrl(recording)}
              title={`Spotify ${recording.externalId}`}
              className="h-[152px] w-full rounded-xl"
              allow="encrypted-media"
              loading="lazy"
            />
          ),
        )}
      </div>
    </section>
  );
}
