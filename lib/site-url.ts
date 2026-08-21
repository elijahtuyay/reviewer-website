import "server-only";

/**
 * The site's canonical origin. SERVER ONLY, deliberately in its own module.
 *
 * Why this is not in `lib/site.ts`: that module also exports SITE_NAME and the
 * affiliation disclaimer, which SiteHeader and SiteFooter import. Those are
 * Server Components today, but they are exactly the kind that turns client the
 * first time someone adds a dropdown — and the moment any client component
 * imports anything from a module, the whole module is bundled. This value is
 * resolved from a NON-`NEXT_PUBLIC_` environment variable, which Next does not
 * inline into client bundles, so in the browser it would silently fall through
 * to localhost. No error, no warning, no lint failure: every canonical URL on
 * the site would just quietly be wrong.
 *
 * Splitting the module means a client component would have to reach past
 * SITE_NAME and import this file by name to break it. `import "server-only"`
 * above makes even that a build error rather than a silent one.
 *
 * Resolved at BUILD time, in this order:
 *
 *  1. `NEXT_PUBLIC_SITE_URL` — an explicit override, and what a custom domain
 *     sets. Always wins.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL` — injected automatically by Vercel as the
 *     project's production hostname, without a scheme. This exists so a deploy
 *     that forgets step 1 cannot silently publish a sitemap and a full set of
 *     canonicals pointing at localhost. It is the production host even on
 *     preview builds, which is what a canonical URL should say anyway.
 *  3. localhost, for local development.
 */

/** Trailing slashes and stray whitespace both corrupt a concatenated URL; strip both. */
function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    const origin = normalizeOrigin(explicit);
    // Fail loudly and by name. `new URL()` in app/layout.tsx would otherwise
    // throw ERR_INVALID_URL from a stack trace that never mentions which
    // environment variable is at fault.
    if (!/^https?:\/\//.test(origin)) {
      throw new Error(
        `NEXT_PUBLIC_SITE_URL must include a scheme, e.g. https://example.com (received: ${JSON.stringify(
          process.env.NEXT_PUBLIC_SITE_URL
        )})`
      );
    }
    return origin;
  }

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelHost) {
    // Vercel documents this as scheme-less, but stripping one costs nothing and
    // "https://https://host" parses without complaint rather than throwing.
    return `https://${normalizeOrigin(vercelHost).replace(/^https?:\/\//, "")}`;
  }

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();
