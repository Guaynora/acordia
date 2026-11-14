import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { availableHandle } from "@/domain/handle";
import { getDb } from "../db/client";
import { accounts, sessions, users, verifications } from "../db/schema";
import { DrizzleUserRepository } from "../repositories/drizzle-user-repository";

/**
 * Google is optional so the site still runs (read-only for everyone) when the
 * OAuth client is not configured yet, e.g. on a fresh checkout.
 */
function googleProvider() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set: Google sign-in is disabled.");
    return {};
  }
  return { google: { clientId, clientSecret } };
}

function createAuth() {
  return betterAuth({
    // BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment.
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      usePlural: true,
      schema: { users, sessions, accounts, verifications },
    }),
    advanced: { database: { generateId: "uuid" } },
    socialProviders: googleProvider(),
    user: {
      additionalFields: {
        // Set by an admin in the database, never by the person signing up.
        role: { type: "string", required: false, defaultValue: "user", input: false },
        // Assigned by the hook below from the person's name.
        handle: { type: "string", required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const repository = new DrizzleUserRepository(getDb());
            const handle = await availableHandle(user.name, (h) => repository.handleExists(h));
            return { data: { ...user, handle } };
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // Avoids a database query on every request; the cookie is signed.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // Must stay last: lets server actions set the session cookie.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { acordiaAuth?: Auth };

/** Built on first use so builds and tests don't need the auth environment. */
export function getAuth(): Auth {
  globalForAuth.acordiaAuth ??= createAuth();
  return globalForAuth.acordiaAuth;
}
