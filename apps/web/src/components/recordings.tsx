import { embedUrl } from "@/domain/recording-url";
import type { Recording } from "@/domain/song";
import { format } from "@/i18n/format";
import { type AddRecordingLabels, AddRecordingForm } from "./add-recording-form";
import { YouTubePlayer } from "./youtube-player";

export interface RecordingLabels {
  readonly title: string;
  readonly play: string;
  readonly untitled: string;
  readonly add: AddRecordingLabels;
}

/** Official provider players; we embed and never host audio. Anyone signed in can add a link. */
export function Recordings({
  recordings,
  labels,
  songSlug,
}: {
  recordings: readonly Recording[];
  labels: RecordingLabels;
  songSlug: string;
}) {
  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-display text-lg font-semibold">{labels.title}</h2>
      {recordings.map((recording) => {
        const title = recording.title ?? labels.untitled;
        return (
          <figure key={recording.id} className="space-y-2">
            {recording.provider === "youtube" ? (
              <YouTubePlayer
                embedUrl={embedUrl(recording)}
                // Older links have no stored thumbnail; YouTube's default one works for any video.
                thumbnailUrl={recording.thumbnailUrl ?? `https://i.ytimg.com/vi/${recording.externalId}/hqdefault.jpg`}
                title={title}
                playLabel={format(labels.play, { title })}
              />
            ) : (
              <iframe
                src={embedUrl(recording)}
                title={title}
                className="h-[152px] w-full rounded-xl"
                allow="encrypted-media"
                loading="lazy"
              />
            )}
            {recording.title && (
              <figcaption className="text-sm">
                <span className="line-clamp-2 font-semibold">{recording.title}</span>
                {recording.authorName && <span className="block text-muted">{recording.authorName}</span>}
              </figcaption>
            )}
          </figure>
        );
      })}
      <AddRecordingForm songSlug={songSlug} labels={labels.add} />
    </section>
  );
}
