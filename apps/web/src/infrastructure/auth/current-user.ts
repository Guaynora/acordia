import "server-only";
import { headers } from "next/headers";
import type { User } from "@/domain/user";
import { getAuth } from "./auth";

/**
 * The signed-in user, or null. Reads the request, so callers in Server
 * Components must sit behind a <Suspense> boundary. Server actions call this
 * again themselves: a page check alone does not protect a mutation.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, image, handle } = session.user;
  // A session cached before handles existed may lack it for a few minutes.
  return { id, handle: handle ?? "", name, image: image ?? null };
}
