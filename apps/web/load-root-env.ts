import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The monorepo keeps a single .env at the repository root (shared with
 * Docker Compose). Load it for Next.js and drizzle-kit when present;
 * variables already set in the environment win.
 */
export function loadRootEnv(): void {
  const path = resolve(process.cwd(), "../../.env");
  if (existsSync(path)) process.loadEnvFile(path);
}
