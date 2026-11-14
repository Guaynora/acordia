import { canManageArrangement } from "@/domain/permissions";
import type { SongRepository } from "@/domain/song-repository";
import type { Actor } from "@/domain/user";
import { type InputError, optionalText, validateMusic } from "./song-input";
import { meterOverrides, validateVersionDetails } from "./version-input";

export interface EditArrangementInput {
  readonly songSlug: string;
  readonly arrangementSlug: string;
  /** Ignored for the song's first version, whose name and kind are fixed. */
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly key: string;
  readonly tempo: string;
  readonly timeSignature: string;
  readonly source: string;
}

export type EditArrangementResult =
  | { readonly ok: true; readonly songSlug: string; readonly arrangementSlug: string; readonly main: boolean }
  | { readonly ok: false; readonly errors: readonly InputError[] };

/**
 * Changes a version's chords and details. Its URL stays the same even when
 * the name changes. The song's first version carries the song's own key,
 * tempo and meter, so editing it updates the song too.
 */
export class EditArrangement {
  constructor(private readonly songs: SongRepository) {}

  async execute(input: EditArrangementInput, actor: Actor): Promise<EditArrangementResult> {
    const song = await this.songs.findBySlug(input.songSlug);
    const index = song?.arrangements.findIndex((a) => a.slug === input.arrangementSlug) ?? -1;
    const arrangement = song?.arrangements[index];
    if (!song || !arrangement) return { ok: false, errors: [{ field: "song", code: "not_found" }] };
    if (!canManageArrangement(actor, arrangement)) return { ok: false, errors: [{ field: "song", code: "forbidden" }] };

    const main = index === 0;
    const errors: InputError[] = [];
    const details = main ? null : validateVersionDetails(input);
    if (details) errors.push(...details.errors);

    const { errors: musicErrors, music } = validateMusic(input, { optionalMeter: !main });
    errors.push(...musicErrors);
    if (errors.length > 0 || !music) return { ok: false, errors };

    if (main) {
      await this.songs.updateArrangement(
        arrangement.id,
        {
          name: arrangement.name,
          kind: arrangement.kind,
          description: arrangement.description,
          key: music.key,
          // The first version inherits tempo and meter from the song.
          tempo: null,
          timeSignature: null,
          chordpro: music.chordpro,
        },
        {
          id: song.id,
          changes: { originalKey: music.key, tempo: music.tempo, timeSignature: music.timeSignature ?? "4/4" },
        },
      );
    } else if (details) {
      await this.songs.updateArrangement(
        arrangement.id,
        {
          name: details.name,
          kind: details.kind,
          description: optionalText(input.description, 280),
          key: music.key,
          ...meterOverrides(music, song),
          chordpro: music.chordpro,
        },
        null,
      );
    }
    return { ok: true, songSlug: song.slug, arrangementSlug: arrangement.slug, main };
  }
}
