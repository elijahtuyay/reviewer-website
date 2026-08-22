import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * THE DATABASE SCHEMA.
 *
 * The first four tables are better-auth's required shape. Their column names
 * are dictated by the library, not chosen: better-auth queries them by name, so
 * renaming `emailVerified` to something more to our taste would break sign-in
 * with no compile error. Keep them exactly as they are.
 *
 * Anything below those four is ours, and follows the project's own naming.
 *
 * The migration files generated from this live in `drizzle/` and ARE committed.
 * That is deliberate: the schema becomes reviewable in a pull request like any
 * other code, rather than being clicked into existence in a dashboard where
 * nobody can see what changed or when.
 */

/* ------------------------------------------------------------ better-auth -- */

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    /**
     * False until the address is proven. Email sending is not wired up yet (it
     * needs a domain we do not own), so nothing currently sets this true. It
     * exists now so that turning verification on later is a config change
     * rather than a migration against a table with live accounts in it.
     */
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * Case-insensitive uniqueness. Postgres would otherwise happily hold both
     * `Elijah@example.com` and `elijah@example.com` as separate accounts, which
     * is an account-takeover vector as much as an annoyance: a person signing up
     * with a different capitalization gets a second, empty account and cannot
     * work out why their password "stopped working".
     *
     * The application also lowercases on write, but that is a convention a future
     * code path can forget. Indexing `lower(email)` rather than `email` is what
     * makes it an invariant the database enforces: a plain unique index on the
     * column is case-SENSITIVE and would happily accept both spellings.
     */
    uniqueIndex("user_email_lower_unique").on(sql`lower(${t.email})`),
    /**
     * Serves the lookup, which the expression index above cannot.
     *
     * Sign-in and sign-up both query `where email = $1` against the bare column.
     * A `lower(email)` index does not satisfy that predicate, so every
     * authentication attempt was a sequential scan over the whole table.
     * Irrelevant at six rows and not something to discover at sixty thousand.
     */
    index("user_email_idx").on(t.email),
  ]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    /**
     * better-auth stores the session token here. It is the bearer credential:
     * anyone holding it is the user. It is indexed for lookup on every request,
     * and rows are deleted rather than flagged on sign-out, which is what makes
     * "sign out everywhere" a single DELETE.
     */
    token: text("token").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      // Cascade, so deleting a user cannot leave a live session behind that
      // still authenticates as them.
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("session_token_unique").on(t.token),
    // Every request looks a session up by user, and revocation deletes by user.
    index("session_userId_idx").on(t.userId),
    /**
     * The no-raw-IP rule, enforced structurally rather than behaviorally.
     *
     * `lib/auth/server.ts` strips the address in a create hook, which is where
     * the stripping has to happen. But a hook is a behavior: delete it, add a
     * plugin that writes its own session, or switch the rate limiter to database
     * storage, and the guarantee lapses with no error and no sign that anything
     * changed. This constraint makes that a loud failure instead of a silent
     * privacy regression, the same argument already made twice above for
     * `user_email_lower_unique` and `account_issuer_accountId_unique`.
     */
    check("session_no_raw_ip", sql`${t.ipAddress} is null`),
  ]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    /**
     * Who vouched for this identity. Written as `local:credential` for an
     * email+password account and `local:oauth:<provider>` for an OAuth one.
     *
     * This is a security column, not bookkeeping. `accountId` is only unique
     * *within* the party that issued it, so two providers can legitimately hand
     * out the same one. Matching on `accountId` alone would then let an account
     * from one issuer link to a user established by another, which is an account
     * takeover. The unique index below is on the pair for exactly that reason.
     *
     * Required by better-auth 1.7; earlier versions had no such column, so a
     * schema written against an older example silently 500s on sign-up.
     */
    issuer: text("issuer").notNull(),
    accountId: text("accountId").notNull(),
    /** "credential" for email+password. A future OAuth provider gets its own rows here. */
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
    scope: text("scope"),
    /**
     * The password hash, and the reason passwords live here rather than on
     * `user`: adding an OAuth provider later is then a new row, not a migration
     * that touches the table holding every account.
     *
     * Hashed by better-auth with scrypt. Never a plaintext password, and never
     * logged, returned by an API, or included in a SELECT that reaches a client.
     */
    password: text("password"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("account_userId_idx").on(t.userId),
    /**
     * The identity invariant, enforced by the database rather than trusted to
     * application code: one account per (issuer, accountId) pair. better-auth
     * declares this index itself and looks accounts up by exactly this pair.
     */
    uniqueIndex("account_issuer_accountId_unique").on(t.issuer, t.accountId),
  ]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    /** What is being verified: an email address, a reset request, and so on. */
    identifier: text("identifier").notNull(),
    /** The token. Single-use: consumed rows are deleted, never marked. */
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("verification_identifier_idx").on(t.identifier),
    // A scheduled sweep deletes expired rows; this keeps that cheap.
    index("verification_expiresAt_idx").on(t.expiresAt),
  ]
);

/* ------------------------------------------------------------------ ours -- */

/**
 * A durable audit trail, separate from application logs.
 *
 * Logs on a serverless platform have short retention and are not queryable
 * after it lapses. This table is the record that survives, and it is also what
 * a future "recent activity" panel on the account page reads from.
 *
 * What must NEVER be written here: passwords, password hashes, session tokens,
 * reset tokens, or raw IP addresses. `ipHash` is a keyed hash precisely so that
 * this table is useful for spotting an attack without becoming a store of
 * personal data. Under the Philippine Data Privacy Act an IP tied to an account
 * is personal information, and keeping it would need a retention and disclosure
 * story this project does not have.
 */
export const securityEvent = pgTable(
  "security_event",
  {
    id: text("id").primaryKey(),
    /** One of a fixed set: signup, login_ok, login_fail, password_changed, sessions_revoked. */
    type: text("type").notNull(),
    /** Null for events with no established identity, e.g. a login attempt for an address that does not exist. */
    userId: text("userId").references(() => user.id, { onDelete: "set null" }),
    /** Keyed hash of the client IP, never the address itself. */
    ipHash: text("ipHash"),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("security_event_userId_idx").on(t.userId),
    index("security_event_createdAt_idx").on(t.createdAt),
  ]
);

/**
 * Sliding-window counters for rate limiting.
 *
 * In Postgres rather than a cache because this has to be correct under
 * concurrency: two simultaneous login attempts must not both read a stale count
 * and both be allowed. A row here is a single upsert, and the window is checked
 * against `windowStart` on read.
 *
 * `key` is scope-prefixed and the subject is hashed, e.g. `login:acct:<id>` or
 * `reset:email:<hmac>` — never a bare email address, for the same reason as
 * `ipHash` above.
 *
 * This is OUR table, for a limiter this project has not written yet. It is NOT
 * better-auth's `rateLimit` model, whose shape is `{ key, count, lastRequest }`,
 * and it is deliberately not registered with the Drizzle adapter. Setting
 * `rateLimit.storage: "database"` will therefore NOT start using this table; it
 * would look for the library's own shape and fail. Until our limiter exists,
 * better-auth's default applies: enabled in production only, stored in memory,
 * which on Vercel means per-instance counters that die with every cold start.
 * Treat cross-instance rate limiting as absent, not merely weak.
 */
export const rateLimit = pgTable("rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("windowStart", { withTimezone: true }).notNull().defaultNow(),
  /** Set when a limit is tripped, so a breach can back off rather than reset instantly. */
  blockedUntil: timestamp("blockedUntil", { withTimezone: true }),
});
