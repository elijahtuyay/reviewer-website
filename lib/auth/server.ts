import "server-only";

import { betterAuth } from "better-auth";
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
      "BETTER_AUTH_SECRET is not set. Generate one with " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"` " +
        "and add it to .env.local and to the Vercel project's environment variables."
    );
  }
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET is too short; use at least 32 bytes of randomness.");
  }
  return secret;
}

export const auth = betterAuth({
  secret: authSecret(),
  baseURL: SITE_URL,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

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
     * Changing a password ends every other session. The whole point of changing
     * it is usually to evict someone, and leaving their session alive defeats
     * that entirely.
     */
    revokeOtherSessionsOnPasswordChange: true,
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

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    /**
     * Slide the expiry when a session is used but older than a day. Without
     * this every session is a hard 30-day cliff; with a shorter update age it
     * writes to the database on nearly every request.
     */
    updateAge: 60 * 60 * 24,
  },

  advanced: {
    /**
     * Cookie hardening. Each of these is doing a specific job:
     *
     *  - `httpOnly` keeps the session token out of reach of JavaScript, so an
     *    XSS cannot read it and send it somewhere.
     *  - `secure` refuses to send it over plain HTTP.
     *  - `sameSite: "lax"` and NOT "strict". Strict would drop the cookie on any
     *    inbound link, which users experience as being logged out whenever they
     *    arrive from an email or another site. Lax blocks the cross-site POSTs
     *    that matter for CSRF while leaving normal navigation working.
     */
    defaultCookieAttributes: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    },
    /**
     * Only origins on this list may make state-changing requests. Left
     * unrestricted, any site could POST to the sign-in endpoint with a victim's
     * cookies attached. Localhost is included so development works; it is
     * harmless in production because an attacker cannot make a browser treat
     * their page as localhost.
     */
    trustedOrigins: [SITE_URL, "http://localhost:3000"],
  },
});

export type Auth = typeof auth;
