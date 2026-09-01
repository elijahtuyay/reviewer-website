import "server-only";

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { SITE_URL } from "@/lib/site-url";

/**
 * THE AUTH SERVER.
 *
 * Deliberately a library rather than a service. Password hashing, session
 * issuance and rotation, token expiry, and constant-time comparison are all
 * things with a well-known way to get subtly wrong, and better-auth implements
 * them; the data still lives in our own database where we can query it.
 *
 * What this file must never grow: a hand-rolled crypto primitive. If something
 * here needs a random token or a hash, it comes from the library or from
 * `crypto`, never from an implementation written for the occasion.
 */

function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is not set. Generate one from 32 random bytes " +
        "encoded base64url, and add it to .env.local and to the Vercel " +
        "project's environment variables."
    );
  }
  // Characters, not bytes, and the message now says so. A base64url encoding of
  // 32 random bytes is 43 characters, so anything shorter than 32 is either
  // hand-typed or truncated. better-auth runs its own entropy estimate on top
  // of this; treat that as the real check and this as a typo guard.
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET is too short; use at least 32 characters.");
  }
  return secret;
}

/**
 * The origin this server considers its own.
 *
 * NOT simply `SITE_URL`, and the difference is load-bearing. `SITE_URL` is the
 * canonical marketing URL: it deliberately resolves to the PRODUCTION host even
 * on a preview deployment, because a preview's sitemap and canonical tags must
 * not claim to be the real site. Auth needs the opposite. Trusted origins are
 * derived from `baseURL`, so pinning a preview to the production origin makes
 * every state-changing request on that preview fail its origin check, with a
 * config that looks entirely correct while doing it.
 */
function authBaseURL(): string {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return SITE_URL;
}

/**
 * Assigned to a typed constant BEFORE it reaches `betterAuth`, and that is not
 * a stylistic choice.
 *
 * `betterAuth` is declared `<Options extends BetterAuthOptions>(options: Options
 * & {})`. Inferring the generic from the object literal, plus the `& {}`, makes
 * excess-property checking UNRELIABLE at that call site rather than absent, and
 * unreliable is the worse of the two. Measured on this file: a small options
 * literal does get flagged, but once the object grew to its real shape, with the
 * adapter and a hook function in it, TypeScript went quiet and two invented
 * options compiled clean. Both were silently ignored at runtime, and both
 * carried a confident comment claiming a protection that was never configured.
 *
 * `satisfies` checks the literal against the type before inference is involved,
 * so it does not have that failure mode. If you add an option and the build
 * fails here, the option is wrong. Do not reach for a cast to make it pass.
 */
const options = {
  secret: authSecret(),
  baseURL: authBaseURL(),

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  /**
   * Warn and above. At `info`, better-auth logs the submitted address on every
   * duplicate sign-up ("Sign-up attempt for existing email: ..."), which would
   * put raw email addresses into platform logs. An email tied to an account is
   * personal information under the Data Privacy Act on exactly the same footing
   * as the IP addresses stripped below, and platform logs are a retained record
   * just as the database is. Applying the privacy argument to one store and not
   * the other was an inconsistency, not a decision.
   */
  logger: { level: "warn" },

  /**
   * Explicit limits, replacing the library default of 100 requests per 10
   * seconds applied uniformly to every endpoint. Sign-up is the expensive one:
   * each call is a Vercel invocation plus two writes to the single production
   * database, and better-auth's built-in path rules cover only the
   * password-reset and verification-email paths, so sign-up was getting the
   * generic allowance.
   *
   * READ THIS BEFORE RELYING ON IT: the default storage is in-memory, which on
   * Vercel means per-instance and gone on every cold start. Our own `rate_limit`
   * table is NOT better-auth's model (it expects `{ key, count, lastRequest }`)
   * and is not registered with the adapter, so `storage: "database"` would not
   * pick it up. Treat cross-instance rate limiting as ABSENT, not merely weak.
   * This raises the cost of a casual script and does nothing against a
   * distributed one; the route-level kill switch is what actually protects the
   * database today.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-up/email": { window: 3600, max: 3 },
      "/sign-in/email": { window: 300, max: 10 },
    },
  },

  emailAndPassword: {
    enabled: true,
    /**
     * Off, and this is a deliberate, temporary state.
     *
     * Verification requires sending email, which requires a verified sending
     * domain, which requires owning a domain. Until then an unverified account
     * can sign in. That is acceptable for the test accounts this exists to
     * support, and it is stated plainly in the sign-up UI rather than left for
     * someone to discover.
     *
     * The consequence to keep in mind: with no email, a forgotten password
     * cannot be recovered by the user. Turning this on later is this flag plus
     * a mail transport, not a migration.
     */
    requireEmailVerification: false,

    /**
     * Off, and this is what closes user enumeration on sign-up.
     *
     * better-auth returns a synthetic success for an already-registered address,
     * hashing the password anyway so the timing matches, but only when
     * `requireEmailVerification` is on OR `autoSignIn` is off. With both at
     * their defaults an existing address returns 422 USER_ALREADY_EXISTS while a
     * new one returns 200, which tells an attacker exactly who has an account.
     * Verification cannot be turned on without email, so this is the lever that
     * is actually available.
     *
     * The cost, which the sign-up UI must absorb: sign-up no longer returns a
     * session, and a returning user gets the same success response as a new one.
     * The copy has to be non-committal to match, along the lines of "Account
     * created. If this address was already registered, sign in with your
     * existing password." Claiming a new account was created would be a lie half
     * the time.
     */
    autoSignIn: false,

    /**
     * Eight is the floor, not the recommendation. Composition rules (a digit, a
     * symbol, a capital) are deliberately absent: they push people toward
     * predictable substitutions like "Password1!" while blocking genuinely
     * strong passphrases, and NIST stopped recommending them years ago. Length
     * plus a breached-password check is the pair that actually works, and the
     * breach check belongs in a later PR.
     */
    minPasswordLength: 8,
    maxPasswordLength: 256,

    /**
     * End every session when a password is reset through the recovery flow.
     *
     * Note what this does NOT cover, because an earlier revision of this file
     * got it wrong: it does not apply to a signed-in user CHANGING their
     * password. There is no option for that at all. `/change-password` takes a
     * `revokeOtherSessions` boolean in the REQUEST BODY, defaulting to false, so
     * the sign-in UI must pass it explicitly. If it does not, changing a
     * password will not evict an attacker holding a stolen session, which is the
     * single thing users believe it does.
     */
    revokeSessionsOnPasswordReset: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    /**
     * Slide the expiry when a session is used but older than a day. Without
     * this every session is a hard 30-day cliff; with a shorter update age it
     * writes to the database on nearly every request.
     *
     * Sliding also means an actively used session has no hard ceiling, so 30
     * days is only defensible once a user can see and revoke their own sessions.
     * Those endpoints already exist behind the catch-all route; only the UI is
     * missing. Ship that list with the first auth UI, or shorten this to 7 days
     * until it exists.
     */
    updateAge: 60 * 60 * 24,
  },

  /**
   * Keep raw client IPs out of the database.
   *
   * better-auth populates `session.ipAddress` with the client address by
   * default, which would sit at rest for the 30-day life of every session.
   * `lib/db/schema.ts` states plainly that this project does not store raw IPs:
   * under the Philippine Data Privacy Act an address tied to an account is
   * personal information, and retaining it needs a retention and disclosure
   * story this project does not have.
   *
   * Note what this deliberately does NOT do. The obvious lever,
   * `advanced.ipAddress.disableIpTracking`, would also blind the rate limiter,
   * trading a privacy gain for an abuse regression. Stripping the value here
   * instead leaves the address available to the live request, where rate
   * limiting needs it, and drops it on the way to disk, which is the only place
   * it would become a retained record.
   *
   * `create` is the only hook needed: `ipAddress` is written in exactly one
   * place in the library, inside `createSession`. The `updateAge` refresh path
   * updates `expiresAt` and `updatedAt` only, so a refreshed session keeps the
   * null this wrote. A CHECK constraint in the schema backs this up
   * structurally, because a behavioral guarantee lapses silently the day
   * someone edits this file.
   *
   * If a "recent sign-in activity" surface is ever built, the value to store is
   * a keyed hash, never the address, matching `security_event.ipHash`.
   */
  databaseHooks: {
    session: {
      create: {
        before: async (session) => ({ data: { ...session, ipAddress: null } }),
      },
    },
  },

  /**
   * Only these origins may make state-changing requests.
   *
   * TOP LEVEL, not inside `advanced`. It reads as though it belongs with the
   * other hardening below, and it was written there originally, where it was
   * silently discarded: `advanced` has no such key, so the effective list
   * quietly fell back to the `baseURL` origin alone.
   *
   * Localhost is added only in development. Adding it unconditionally would
   * mean a production deployment trusts whatever the visitor happens to be
   * running on port 3000, which turns the callback-URL validation that shares
   * this list into an open redirect.
   */
  trustedOrigins: [
    SITE_URL,
    ...(process.env.NODE_ENV === "development" ? ["http://localhost:3000"] : []),
  ],

  advanced: {
    /**
     * Cookie hardening. Each of these is doing a specific job:
     *
     *  - `httpOnly` keeps the session token out of reach of JavaScript, so an
     *    XSS cannot read it and send it somewhere.
     *  - `secure` refuses to send it over plain HTTP. Chrome and Firefox treat
     *    localhost as a secure context so development works; Safari has not
     *    always, which is the first thing to suspect if a dev sign-in appears
     *    not to persist there.
     *  - `sameSite: "lax"` and NOT "strict". Strict would drop the cookie on any
     *    inbound link, which users experience as being logged out whenever they
     *    arrive from an email or another site. Lax blocks the cross-site POSTs
     *    that matter for CSRF while leaving normal navigation working.
     *
     * SameSite is the second layer here, not the first. The real CSRF defense is
     * better-auth's own origin check, which requires a matching Origin or
     * Referer on every cookie-bearing mutation and rejects a missing one.
     */
    defaultCookieAttributes: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    },
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth(options);

export type Auth = typeof auth;
