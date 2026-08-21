/**
 * Site-level constants that outlive any single exam: what the product is
 * called and the legal notice it carries.
 *
 * Everything here is safe in a client bundle. The canonical origin
 * deliberately lives in `lib/site-url.ts` instead, because it reads a
 * non-public environment variable and would silently resolve to localhost if
 * it were ever bundled for the browser. See that file for the full reasoning.
 */

export const SITE_NAME = "Exam Reviewer";

export const SITE_TAGLINE = "Free, timed practice exams with every answer explained.";

/**
 * Shown in the footer and on the about section of the home page. This is a
 * genuinely independent study tool: naming the real exam is nominative fair
 * use, but implying endorsement is not, so the disclaimer is not optional
 * decoration.
 */
export const AFFILIATION_DISCLAIMER =
  "This site is an independent study tool. It is not affiliated with, endorsed by, or connected to the Graduate Management Admission Council (GMAC) or any testing body. Every question here is originally written for practice and does not reproduce actual examination content. Practising here does not guarantee any particular exam result.";
