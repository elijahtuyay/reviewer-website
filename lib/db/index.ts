import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/lib/db/schema";

/**
 * The database handle. SERVER ONLY, and `import "server-only"` above makes that
 * a build error rather than a silent one — a connection string reaching a
 * client bundle would be a credential leak, not merely a bug.
 *
 * Two connection strings exist and they are not interchangeable:
 *
 *  - `DATABASE_URL` is Neon's POOLED endpoint. Serverless functions are created
 *    and destroyed per request, so without pooling a traffic spike opens a
 *    connection per invocation and exhausts the database. This is what the app
 *    uses.
 *  - `DATABASE_URL_UNPOOLED` is a direct connection, required by migrations,
 *    which need a session that survives multiple statements. See drizzle.config.ts.
 *
 * Both are injected by the Vercel/Neon integration; neither is ever committed.
 */
function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Run `vercel env pull .env.local` to fetch it, " +
        "or add it in the Vercel project's environment variables."
    );
  }
  return url;
}

export const db = drizzle(neon(connectionString()), { schema });

export type Database = typeof db;
