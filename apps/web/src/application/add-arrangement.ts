import { slugify } from "@/domain/slug";
import { RESERVED_ARRANGEMENT_SLUGS } from "@/domain/song";
import type { SongRepository } from "@/domain/song-repository";
import type { Actor } from "@/domain/user";
import { type InputError, optionalText, validateMusic } from "./song-input";
import { meterOverrides, validateVersionDetails } from "./version-input";

export interface AddArrangementInput {
  readonly songSlug: string;
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly key: string;
  /** Empty means "same as the song". */
  readonly tempo: string;
  /** Empty means "same as the song". */
  readonly timeSignature: string;
  readonly source: string;
}

export type AddArrangementResult =
  | { readonly ok: true; readonly songSlug: string; readonly arrangementSlug: string }
  | { readonly ok: false; readonly errors: readonly InputError[] };

/** Adds another version (simplified, reharmonized...) to an existing song. */
export class AddArrangement {
  constructor(private readonly songs: SongRepository) {}

  async execute(input: AddArrangementInput, actor: Actor): Promise<AddArrangementResult> {
    const song = await this.songs.findBySlug(input.songSlug);
    if (!song) return { ok: false, errors: [{ field: "song", code: "not_found" }] };

    const { errors: detailErrors, name, kind } = validateVersionDetails(input);
    const errors: InputError[] = [...detailErrors];

    const { errors: musicErrors, music } = validateMusic(input, { optionalMeter: true });
    errors.push(...musicErrors);
    if (errors.length > 0 || !music) return { ok: false, errors };

    const taken = new Set(song.arrangements.map((a) => a.slug));
    const base = slugify(name) || "version";
    let slug = base;
    for (let n = 2; taken.has(slug) || RESERVED_ARRANGEMENT_SLUGS.has(slug); n++) slug = `${base}-${n}`;

    await this.songs.addArrangement(song.id, {
      slug,
      name,
      kind,
      description: optionalText(input.description, 280),
      authorId: actor.id,
      key: music.key,
      ...meterOverrides(music, song),
      chordpro: music.chordpro,
    });
    return { ok: true, songSlug: song.slug, arrangementSlug: slug };
  }
}
