import { defineConfig } from "drizzle-kit";
import { loadRootEnv } from "./load-root-env";

loadRootEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/infrastructure/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
