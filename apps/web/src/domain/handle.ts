import { slugify } from "./slug";

/** Public alias used in profile URLs: /u/jonathan-guaynora. */
export const MAX_HANDLE_LENGTH = 30;
const FALLBACK = "musico";

/** "Jonathan Guaynora" -> "jonathan-guaynora"; never empty. */
export function handleFromName(name: string): string {
  const base = slugify(name).slice(0, MAX_HANDLE_LENGTH).replace(/-+$/, "");
  return base || FALLBACK;
}

/**
 * First free alias for a name: the plain one, then "-2", "-3"... keeping the
 * result within the length limit.
 */
export async function availableHandle(name: string, isTaken: (handle: string) => Promise<boolean>): Promise<string> {
  const base = handleFromName(name);
  if (!(await isTaken(base))) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = base.slice(0, MAX_HANDLE_LENGTH - suffix.length).replace(/-+$/, "") + suffix;
    if (!(await isTaken(candidate))) return candidate;
  }
}
