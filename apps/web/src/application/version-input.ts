import { ARRANGEMENT_KINDS, type ArrangementKind, type Song } from "@/domain/song";
import type { InputError, Music } from "./song-input";

/** Name and kind of a version other than the original. */
export function validateVersionDetails(input: { readonly name: string; readonly kind: string }): {
  readonly errors: InputError[];
  readonly name: string;
  readonly kind: ArrangementKind;
} {
  const errors: InputError[] = [];
  const name = input.name.trim().slice(0, 60);
  if (!name) errors.push({ field: "name", code: "required" });
  const kind = input.kind as ArrangementKind;
  if (!(ARRANGEMENT_KINDS as readonly string[]).includes(kind) || kind === "original") {
    errors.push({ field: "kind", code: "invalid_kind" });
  }
  return { errors, name, kind };
}

/** A version stores its own tempo and meter only when they differ from the song's. */
export function meterOverrides(music: Music, song: Pick<Song, "tempo" | "timeSignature">) {
  return {
    tempo: music.tempo !== null && music.tempo !== song.tempo ? music.tempo : null,
    timeSignature:
      music.timeSignature !== null && music.timeSignature !== song.timeSignature ? music.timeSignature : null,
  };
}
