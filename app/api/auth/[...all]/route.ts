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

/**
 * The account endpoints are OFF by default, and this is the point of the flag.
 *
 * There is no sign-in UI, no route reads a session, and nothing in the app calls
 * any of these endpoints — but the handler still mounted every one of them,
 * publicly, on the internet. `/api/auth/sign-up/email` was therefore an
 * anonymous, effectively unmetered write into the one production database (there
 * is no staging copy and no backup story), in a PUBLIC repo that documents the
 * schema and the absence of a limiter. better-auth's origin check only fires on
 * cookie-bearing requests, correctly, so a plain scripted POST is never
 * origin-checked at all.
 *
 * The failure mode is not account compromise — there are no accounts. It is
 * cost and availability: enough writes exhaust the Neon free tier, and enough
 * invocations make Vercel Hobby pause the whole project, taking down an exam
 * site that has nothing to do with auth. Cleanup would be a manual DELETE
 * against production.
 *
 * Serving 404 rather than 403 keeps the surface unadvertised. Flip
 * AUTH_ROUTES_ENABLED=1 in the same PR that ships the sign-in UI — and read the
 * "known-open security items" in PROJECT_CONTEXT.md before you do, because rate
 * limiting still does not survive a cold start.
 */
const authRoutesEnabled = process.env.AUTH_ROUTES_ENABLED === "1";

const handlers = toNextJsHandler(auth.handler);
const notFound = () => new Response(null, { status: 404 });

export const GET = authRoutesEnabled ? handlers.GET : notFound;
export const POST = authRoutesEnabled ? handlers.POST : notFound;
