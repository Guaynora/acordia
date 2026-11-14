import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/infrastructure/auth/auth";

// Sign-in redirects, OAuth callbacks and sign-out for Better Auth.
const handler = (request: Request) => getAuth().handler(request);

export const { GET, POST } = toNextJsHandler(handler);
