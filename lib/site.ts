/**
 * Site-level constants that outlive any single exam. Kept apart from
 * `exam-config.ts`, which describes exams; this describes the product they
 * live in (name, canonical URL, legal disclaimer).
 */

export const SITE_NAME = "Exam Reviewer";

export const SITE_TAGLINE = "Free, timed practice exams with every answer explained.";

/**
 * Canonical origin, used for metadataBase, the sitemap, and robots.txt.
 *
 * Set NEXT_PUBLIC_SITE_URL in the host's environment once a real domain
 * exists. It falls back to localhost so `next build` never emits absolute
 * URLs pointing at a domain that isn't live yet, and never fails the build
 * for a missing variable.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);

/**
 * Shown in the footer and on the about section of the home page. This is a
 * genuinely independent study tool: naming the real exam is nominative fair
 * use, but implying endorsement is not, so the disclaimer is not optional
 * decoration.
 */
export const AFFILIATION_DISCLAIMER =
  "This site is an independent study tool. It is not affiliated with, endorsed by, or connected to the Graduate Management Admission Council (GMAC) or any testing body. Every question here is originally written for practice and does not reproduce actual examination content. Practising here does not guarantee any particular exam result.";
