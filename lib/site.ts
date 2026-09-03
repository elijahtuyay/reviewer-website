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

export const SITE_TAGLINE =
  "Free practice exams with real time limits and an explanation for every answer.";

/**
 * Shown in the footer and on the about section of the home page. This is a
 * genuinely independent study tool: naming the real exam is nominative fair
 * use, but implying endorsement is not, so the disclaimer is not optional
 * decoration.
 *
 * Written to ASD-STE100: short simple-tense sentences, one claim each, so a
 * non-native reader cannot come away with the wrong idea about who runs this
 * site. A legal notice is the last place to spend a subordinate clause.
 */
export const AFFILIATION_DISCLAIMER =
  "This site is an independent study tool. It has no connection to the Graduate Management Admission Council (GMAC) or to any other test provider. GMAC does not endorse this site. A person writes every question here for practice only. No question is a copy of real exam content. Practice on this site does not guarantee a result on your exam.";
