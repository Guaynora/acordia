import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The monorepo keeps its env files at the repository root (.env is shared
 * with Docker Compose). Load them for Next.js and drizzle-kit when present.
 * Precedence: variables already set in the environment, then .env.local
 * (personal secrets, git-ignored), then .env. loadEnvFile never overrides a
 * variable that is already set, so the first file loaded wins.
 */
export function loadRootEnv(): void {
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), "../../", name);
    if (existsSync(path)) process.loadEnvFile(path);
  }
}
