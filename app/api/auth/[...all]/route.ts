import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth/server";

/**
 * Every auth endpoint, mounted under /api/auth/*.
 *
 * This is the ONLY dynamic route in the application. Everything else is
 * prerendered at build time, and that must stay true: the route table printed
 * by `npm run build` should show this handler and nothing else as dynamic. If a
 * page ever flips from static to dynamic, the cause is almost certainly a
 * session being read somewhere in the React tree instead of over fetch.
 *
 * `force-dynamic` is explicit rather than inferred, because a cached auth
 * response would be a security bug: one user's session handed to the next
 * visitor.
 */
export const dynamic = "force-dynamic";

export const { GET, POST } = toNextJsHandler(auth.handler);
