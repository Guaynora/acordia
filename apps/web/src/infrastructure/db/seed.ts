/**
 * Seeds a public-domain song through the real use case, so the importer and
 * validation run exactly as they do for user uploads.
 */
import { eq } from "drizzle-orm";
import { PublishSong } from "../../application/publish-song";
import type { Actor } from "../../domain/user";
import { DrizzleSongRepository } from "../repositories/drizzle-song-repository";
import { type Database, getDb } from "./client";
import { users } from "./schema";

/** System account credited for seeded content. It has no login method. */
const SEED_EMAIL = "seed@acordia.invalid";

async function seedUser(db: Database): Promise<Actor> {
  await db.insert(users).values({ name: "Acordia", handle: "acordia", email: SEED_EMAIL }).onConflictDoNothing();
  const [user] = await db.select({ id: users.id, name: users.name, handle: users.handle }).from(users).where(eq(users.email, SEED_EMAIL));
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

async function main() {
  const db = getDb();
  const repository = new DrizzleSongRepository(db);
  if (await repository.slugExists("cielito-lindo-tradicional")) {
    console.log("Seed already applied.");
    return;
  }
  const result = await new PublishSong(repository).execute({
    title: "Cielito lindo",
    artist: "Tradicional",
    key: "C",
    tempo: "120",
    timeSignature: "3/4",
    source: CIELITO_LINDO,
    recordingUrls: [],
  }, await seedUser(db));
  console.log(result);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
