import type { RecordingInfoProvider, RecordingLookup, RecordingReference } from "@/domain/recording-url";

/** Answers lookups from a table by id; unknown ids are "found" with a made-up title. */
export class FakeRecordingInfo implements RecordingInfoProvider {
  readonly asked: string[] = [];

  constructor(private readonly answers: Record<string, RecordingLookup> = {}) {}

  async lookup(reference: RecordingReference): Promise<RecordingLookup> {
    this.asked.push(reference.externalId);
    return (
      this.answers[reference.externalId] ?? {
        status: "found",
        info: { title: `Title ${reference.externalId}`, authorName: "Channel", thumbnailUrl: null },
      }
    );
  }
}
