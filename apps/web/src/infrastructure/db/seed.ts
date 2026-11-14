/**
 * Seeds public-domain songs through the real use case, so the importer and
 * validation run exactly as they do for user uploads.
 */
import { eq } from "drizzle-orm";
import { parseKey, transposeChordPro } from "@acordia/chord-engine";
import { AddArrangement } from "../../application/add-arrangement";
import { PublishSong } from "../../application/publish-song";
import type { Actor } from "../../domain/user";
import { OEmbedRecordingInfo } from "../oembed/oembed-recording-info";
import { DrizzleSongRepository } from "../repositories/drizzle-song-repository";
import { type Database, getDb } from "./client";
import { users } from "./schema";

/** System account credited for seeded content. It has no login method. */
const SEED_EMAIL = "seed@acordia.invalid";

async function seedUser(db: Database): Promise<Actor> {
  await db.insert(users).values({ name: "Acordia", handle: "acordia", email: SEED_EMAIL }).onConflictDoNothing();
  const [user] = await db.select({ id: users.id, name: users.name, handle: users.handle, role: users.role }).from(users).where(eq(users.email, SEED_EMAIL));
  if (!user) throw new Error("Seed user could not be created");
  return user;
}

/** Builds a chord line with each chord at the given column. */
function chords(...placed: [number, string][]): string {
  let line = "";
  for (const [column, chord] of placed) line = line.padEnd(column) + chord;
  return line;
}

// "Cielito lindo" (Quirino Mendoza y Cortés, 1882) is in the public domain.
const CIELITO_LINDO = [
  "Estrofa:",
  chords([0, "C"], [13, "G7"]),
  "De la Sierra Morena,",
  chords([22, "C"]),
  "cielito lindo, vienen bajando",
  chords([10, "C7"], [17, "F"]),
  "un par de ojitos negros,",
  chords([0, "C"], [15, "G7"], [24, "C"]),
  "cielito lindo, de contrabando.",
  "",
  "Coro:",
  chords([16, "G7"], [27, "C"]),
  "Ay, ay, ay, ay, canta y no llores,",
  chords([7, "C7"], [19, "F"]),
  "porque cantando se alegran,",
  chords([0, "C"], [15, "G7"], [23, "C"]),
  "cielito lindo, los corazones.",
].join("\n");

// "Amazing Grace": words by John Newton (1779), last verse first printed in
// 1829, sung to "New Britain" (1829). All in the public domain. Written with
// exactly one chord per bar (3/4), so auto-scroll at tempo follows the music.
const AMAZING_GRACE_VERSES = [
  ["A[G]mazing [G7]grace, how [C]sweet the [G]sound", "That [G]saved a [Em]wretch like [D]me, [D7]", "I [G]once was [G7]lost, but [C]now am [G]found,", "Was [Em]blind, but [D]now I [G]see. [G]"],
  ["'Twas [G]grace that [G7]taught my [C]heart to [G]fear,", "And [G]grace my [Em]fears re[D]lieved; [D7]", "How [G]precious [G7]did that [C]grace ap[G]pear", "The [Em]hour I [D]first be[G]lieved. [G]"],
  ["Through [G]many [G7]dangers, [C]toils and [G]snares,", "I [G]have al[Em]ready [D]come; [D7]", "'Tis [G]grace hath [G7]brought me [C]safe thus [G]far,", "And [Em]grace will [D]lead me [G]home. [G]"],
  ["The [G]Lord has [G7]promised [C]good to [G]me,", "His [G]word my [Em]hope se[D]cures; [D7]", "He [G]will my [G7]shield and [C]portion [G]be,", "As [Em]long as [D]life en[G]dures. [G]"],
  ["Yea, [G]when this [G7]flesh and [C]heart shall [G]fail,", "And [G]mortal [Em]life shall [D]cease, [D7]", "I [G]shall pos[G7]sess, with[C]in the [G]veil,", "A [Em]life of [D]joy and [G]peace. [G]"],
  ["When [G]we've been [G7]there ten [C]thousand [G]years,", "Bright [G]shining [Em]as the [D]sun, [D7]", "We've [G]no less [G7]days to [C]sing God's [G]praise", "Than [Em]when we'd [D]first be[G]gun. [G]"],
] as const;

const verse = (n: number, lines: readonly string[], changes: readonly string[] = []) => [
  `{start_of_verse: Verse ${n}}`,
  ...changes,
  ...lines,
  "{end_of_verse}",
  "",
];

const AMAZING_GRACE = [
  "{c: Intro}",
  "[G] [C] [G] [D7]",
  "",
  ...AMAZING_GRACE_VERSES.flatMap((lines, i) => verse(i + 1, lines)),
  "{c: Outro}",
  "[C] [G] [D7] [G]",
].join("\n");

/** Writes ChordPro lines a key higher or lower, with the engine's spelling. */
function inKey(lines: readonly string[], from: string, to: string): string[] {
  const fromKey = parseKey(from);
  const toKey = parseKey(to);
  if (!fromKey || !toKey) throw new Error(`Bad seed keys ${from} -> ${to}`);
  return transposeChordPro(lines.join("\n"), fromKey, toKey).text.split("\n");
}

// A version that exercises every per-section change: a two-bar interlude in
// 4/4, a faster fifth verse back in 3/4, the last verse half a step up, and
// a final ritardando.
const AMAZING_GRACE_BUILD = [
  "{c: Intro}",
  "[G] [C] [G] [D7]",
  "",
  ...AMAZING_GRACE_VERSES.slice(0, 4).flatMap((lines, i) => verse(i + 1, lines)),
  "{c: Interlude}",
  "{time: 4/4}",
  "[C] [D7]",
  "",
  ...verse(5, AMAZING_GRACE_VERSES[4], ["{time: 3/4}", "{tempo: 92}"]),
  ...verse(6, inKey(AMAZING_GRACE_VERSES[5], "G", "Ab"), ["{key: Ab}"]),
  "{c: Outro}",
  "{x_ramp: 92-60 4}",
  "[Db] [Ab] [Eb7] [Ab]",
].join("\n");

interface SeedSong {
  readonly slug: string;
  readonly title: string;
  readonly artist: string;
  readonly key: string;
  readonly tempo: string;
  readonly timeSignature: string;
  readonly source: string;
}

const SONGS: readonly SeedSong[] = [
  {
    slug: "cielito-lindo-tradicional",
    title: "Cielito lindo",
    artist: "Tradicional",
    key: "C",
    tempo: "120",
    timeSignature: "3/4",
    source: CIELITO_LINDO,
  },
  {
    slug: "amazing-grace-john-newton",
    title: "Amazing Grace",
    artist: "John Newton",
    key: "G",
    tempo: "80",
    timeSignature: "3/4",
    source: AMAZING_GRACE,
  },
];

interface SeedVersion {
  readonly songSlug: string;
  readonly slug: string;
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly key: string;
  readonly source: string;
}

const VERSIONS: readonly SeedVersion[] = [
  {
    songSlug: "amazing-grace-john-newton",
    slug: "final-en-ab",
    name: "Final en Ab",
    kind: "other",
    description: "Interludio en 4/4, quinta estrofa más rápida, la última medio tono arriba y un final ritardando.",
    key: "G",
    source: AMAZING_GRACE_BUILD,
  },
];

/** Publishes each song and version that is not there yet, so new seeds apply to old databases. */
async function main() {
  const db = getDb();
  const repository = new DrizzleSongRepository(db);
  const publish = new PublishSong(repository, new OEmbedRecordingInfo());
  const actor = await seedUser(db);
  for (const { slug, ...song } of SONGS) {
    if (await repository.slugExists(slug)) {
      console.log(`${slug}: already seeded.`);
      continue;
    }
    console.log(slug, await publish.execute({ ...song, recordingUrls: [] }, actor));
  }
  const addVersion = new AddArrangement(repository);
  for (const { slug, ...version } of VERSIONS) {
    const song = await repository.findBySlug(version.songSlug);
    if (song?.arrangements.some((a) => a.slug === slug)) {
      console.log(`${version.songSlug}/${slug}: already seeded.`);
      continue;
    }
    console.log(`${version.songSlug}/${slug}`, await addVersion.execute({ ...version, tempo: "", timeSignature: "" }, actor));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
