import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Read .env.local the way Next does. drizzle-kit runs as a plain Node process,
// so it does not inherit Next's env loading and would otherwise see nothing.
config({ path: ".env.local" });

/**
 * Migration tooling config.
 *
 * Note the connection string: `DATABASE_URL_UNPOOLED`, not `DATABASE_URL`.
 * Neon's pooled endpoint hands out a different backend per statement, which is
 * fine for the short queries the app makes and wrong for migrations, which need
 * one session to hold a lock across several statements. Running migrations
 * through the pooler produces intermittent, confusing failures rather than a
 * clean error, so it is worth getting right the first time.
 */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
  // Print the SQL before it runs. This is a solo project with no staging
  // environment; seeing the statements is the review step.
  verbose: true,
  strict: true,
});
