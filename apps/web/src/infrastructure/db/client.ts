import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { acordiaDb?: Database };

/** One connection pool per process, reused across hot reloads in development. */
export function getDb(): Database {
  if (globalForDb.acordiaDb) return globalForDb.acordiaDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repository root.");
  const db = drizzle(postgres(url, { max: 10 }), { schema });
  globalForDb.acordiaDb = db;
  return db;
}
