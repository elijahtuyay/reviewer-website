/**
 * Site-level constants that outlive any single exam. Kept apart from
 * `exam-config.ts`, which describes exams; this describes the product they
 * live in (name, canonical URL, legal disclaimer).
 */

export const SITE_NAME = "Exam Reviewer";

export const SITE_TAGLINE = "Free, timed practice exams with every answer explained.";

/**
 * Canonical origin, used for metadataBase, the sitemap, robots.txt and the
 * home page's JSON-LD.
 *
 * Resolved at BUILD time, in this order:
 *
 *  1. `NEXT_PUBLIC_SITE_URL` — an explicit override. This is what a real custom
 *     domain sets, and it always wins.
 *  2. `VERCEL_PROJECT_PRODUCTION_URL` — injected automatically by Vercel as the
 *     project's production hostname (no scheme). This exists so that a deploy
 *     which forgets step 1 still emits correct absolute URLs instead of
 *     silently publishing a sitemap full of `http://localhost:3000`. It is the
 *     production host even on preview builds, which is what canonical URLs
 *     should point at anyway.
 *  3. localhost, for local development.
 *
 * Every consumer of this value is a Server Component or a metadata route, so
 * reading a non-`NEXT_PUBLIC_` variable here is safe: it is never inlined into
 * a client bundle. Check that again before importing SITE_URL into anything
 * marked `"use client"`.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelHost) return `https://${vercelHost.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl();

/**
 * Shown in the footer and on the about section of the home page. This is a
 * genuinely independent study tool: naming the real exam is nominative fair
 * use, but implying endorsement is not, so the disclaimer is not optional
 * decoration.
 */
export const AFFILIATION_DISCLAIMER =
  "This site is an independent study tool. It is not affiliated with, endorsed by, or connected to the Graduate Management Admission Council (GMAC) or any testing body. Every question here is originally written for practice and does not reproduce actual examination content. Practising here does not guarantee any particular exam result.";
