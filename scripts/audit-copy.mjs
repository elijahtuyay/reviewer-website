/**
 * npm run audit:copy — checks user-facing prose against the ASD-STE100 rules
 * this project writes to.
 *
 * WHY THIS IS A SCRIPT AND NOT A PARAGRAPH IN A DOC. Every other style rule
 * this repo has stated in prose has drifted: copy claimed a section lock that
 * did not exist for months, and PROJECT_CONTEXT.md has produced three separate
 * stale notes. A rule nothing checks is a rule that lapses on the next commit.
 * So the four ASD-STE100 rules that are mechanically decidable are decided
 * mechanically, and the script exits non-zero when one breaks.
 *
 * What it checks:
 *   1. No semicolon in prose (STE Rule 8.1 bans the mark outright).
 *   2. Simple tenses only. No perfect ("you have used") and no progressive
 *      ("the timer is running") verb forms.
 *   3. Sentence length. 25 words for descriptive text.
 *   4. A banned list of phrasal verbs and idioms (Rule 9.3), plus the
 *      one-word-one-meaning synonyms this project has settled: "timer" not
 *      "clock", "select" not "pick"/"choose", "incorrect" not "wrong".
 *
 * What it deliberately does NOT check: whether a word is in ASD's ~900-word
 * approved dictionary. That dictionary is not redistributable and the official
 * PDF is encrypted, so any list here would be guesswork wearing a checkmark.
 *
 * SCOPE. Only the files listed in FILES, and only their prose. Question-bank
 * content is out of scope on purpose: a Language Skills question about the
 * present perfect has to be able to contain the present perfect.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every file that carries user-facing prose. Add a file here when it gains copy. */
const FILES = [
  "app/page.tsx",
  "app/layout.tsx",
  "app/not-found.tsx",
  "app/error.tsx",
  "app/global-error.tsx",
  "app/[examId]/page.tsx",
  "app/[examId]/quiz/[section]/page.tsx",
  "components/SiteFooter.tsx",
  "components/SiteHeader.tsx",
  "components/SessionResetNotice.tsx",
  "components/SectionStartButton.tsx",
  "components/PauseOverlay.tsx",
  "components/ConfirmDialog.tsx",
  "components/ProgressTracker.tsx",
  "components/SectionNav.tsx",
  "components/ResultSummary.tsx",
  "components/QuestionCard.tsx",
  "components/MobileNavSheet.tsx",
  "components/quiz/shared.tsx",
  "components/quiz/FreeFormRunner.tsx",
  "components/quiz/SequentialRunner.tsx",
  "components/quiz/CalculatorPanel.tsx",
  "lib/site.ts",
  "lib/exams/nmat/index.ts",
  "lib/exams/gmat/index.ts",
];

const MAX_WORDS = 25;

/**
 * Perfect and progressive forms. Written as auxiliary + participle/gerund
 * rather than a word list, because the auxiliary alone is fine: "you have
 * three changes left" is simple present and must not be flagged.
 */
const TENSE_RULES = [
  {
    label: "perfect tense (use the simple past)",
    // "have used", "has been", "had started". Allows one adverb between.
    re: /\b(have|has|had)\s+(?:\w+ly\s+)?(been|\w+ed|done|gone|run|begun|written|taken|given|seen|made|kept|left|read|lost|come|become|held|sent|spent|met|drawn|shown|known)\b/i,
  },
  {
    label: "progressive tense (use the simple present)",
    // "is running", "are being built". Excludes -ing words that are nouns
    // after a form of "be" only by exception, of which this app has none.
    re: /\b(am|is|are|was|were|be|being)\s+(?:\w+ly\s+)?\w+ing\b/i,
  },
];

/** Phrasal verbs, idioms, and the synonyms this project has settled against. */
const BANNED = [
  [/\bpick(s|ed)?\s+(up|out)\b/i, 'phrasal verb: say "continue" or "select"'],
  [/\bcarry\s+over\b/i, 'phrasal verb: say "move to"'],
  [/\bgo(es)?\s+back\b/i, 'phrasal verb: say "return"'],
  [/\bcome\s+back\b/i, 'phrasal verb: say "return"'],
  [/\bmove\s+on\b/i, 'phrasal verb: say "continue"'],
  [/\bsign\s+up\b/i, 'phrasal verb: say "register" or "create an account"'],
  [/\bclose(s|d)?\s+(itself\s+)?out\b/i, 'phrasal verb: say "submits"'],
  [/\bfree\s+(this\s+)?up\b/i, 'phrasal verb: say "unlock"'],
  [/\bease(s|d)?\s+off\b/i, 'phrasal verb: say "becomes easier"'],
  [/\bran?\s+out\s+of\s+time\b/i, 'idiom: say "the time ended"'],
  [/\bout\s+of\s+date\b/i, 'idiom: say "old"'],
  [/\bout\s+of\s+reach\b/i, 'idiom: say "not available"'],
  [/\btime\s+to\s+spare\b/i, 'idiom: say "time remains"'],
  [/\bthe\s+real\s+thing\b/i, 'idiom: say "the real exam"'],
  [/\bthe\s+clock\b/i, 'one word per concept: this project says "timer"'],
  [/\bwrong\s+answer/i, 'one word per concept: this project says "incorrect"'],
];

const problems = [];

/**
 * Pull prose out of a source file.
 *
 * Comments go first, because they are full of English sentences that are not
 * copy and would bury a real finding. Then className/style/aria attributes,
 * then anything left that reads like markup or an identifier rather than a
 * sentence. The filter is deliberately conservative: a missed string costs one
 * unchecked sentence, while a false positive costs every future reader's trust
 * in the whole script.
 */
function extractProse(source) {
  let text = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/\bclassName=(?:"[^"]*"|\{`[^`]*`\}|\{[^}]*\})/g, " ")
    .replace(/\bstyle=\{\{[\s\S]*?\}\}/g, " ")
    .replace(/\baria-label(?:ledby|by)?=(?:"[^"]*"|\{[^}]*\})/g, " ")
    .replace(/\b(?:srLabel|href|id|key|type|role|import|from)\s*[:=]\s*"[^"]*"/g, " ");

  const found = [];

  // Quoted and backtick-quoted literals.
  for (const m of text.matchAll(/"((?:[^"\\\n]|\\.){12,})"|`((?:[^`\\]|\\.){12,})`/g)) {
    found.push(m[1] ?? m[2]);
  }
  // JSX text nodes: what sits between a > and a < on the same run.
  for (const m of text.matchAll(/>([^<>{}]{12,})</g)) {
    found.push(m[1]);
  }

  return (
    found
      // Template holes become a neutral word so "you have ${n} left" is not
      // read as a fragment, and so a placeholder never counts as a long word.
      .map((s) => s.replace(/\$\{[^}]*\}/g, "N"))
      // HTML entities carry a literal semicolon. Decoding the handful this app
      // uses is what stops "Section &amp; progress" reading as a Rule 8.1
      // breach, which is a false positive that would teach a reader to skim.
      .map((s) =>
        s
          .replace(/&amp;/g, "and")
          .replace(/&apos;|&rsquo;/g, "'")
          .replace(/&(?:middot|bull|larr|rarr|copy|nbsp|hellip|mdash|ndash);/g, " ")
      )
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => /[a-z]{3}/.test(s))
      // At least three words: filters class lists, ids, paths, single tokens.
      .filter((s) => s.split(" ").length >= 3)
      .filter((s) => !/^[a-z-]+(\s+[a-z0-9:./[\]-]+)+$/.test(s))
      // Markup and operators.
      .filter((s) => !/[<>{}]|=|&&|\|\||\/\//.test(s))
      /*
       * Code that the JSX-text pass swept up. A generic parameter makes
       * `useRef<HTMLElement | null>(null); const x = useRef<` look exactly like
       * a text node between a > and a <, and that alone produced ten of the
       * script's first thirteen findings.
       *
       * The discriminator is punctuation with no space after it. Prose always
       * puts a space after a period or a comma, so `exam.id`, `t.total` and
       * `s.calculator` are code while "8 digits. Above 99,999,999" is not.
       */
      .filter((s) => !/[.,][a-zA-Z]/.test(s))
      .filter((s) => !/\b(?:const|let|return|null|await|function|useRef|useState|props)\b/.test(s))
  );
}

for (const rel of FILES) {
  const source = readFileSync(join(root, rel), "utf8");
  for (const prose of extractProse(source)) {
    const flag = (rule, detail) =>
      problems.push({ file: rel, rule, detail, prose });

    if (prose.includes(";")) flag("Rule 8.1: no semicolon", prose);

    for (const { label, re } of TENSE_RULES) {
      const hit = prose.match(re);
      if (hit) flag(`Simple tenses only: ${label}`, hit[0]);
    }

    for (const [re, why] of BANNED) {
      const hit = prose.match(re);
      if (hit) flag(`Word choice: ${why}`, hit[0]);
    }

    // Sentence length. Split on terminal punctuation followed by a capital, so
    // "8 digits. Above 99,999,999" splits and "GMAC (the ...)" does not.
    for (const sentence of prose.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)) {
      const words = sentence.trim().split(/\s+/).filter(Boolean);
      if (words.length > MAX_WORDS) {
        flag(`Sentence length: ${words.length} words, limit ${MAX_WORDS}`, sentence.trim());
      }
    }
  }
}

if (problems.length === 0) {
  console.log(`audit:copy — ${FILES.length} files, no findings.`);
  process.exit(0);
}

console.error(`audit:copy — ${problems.length} finding(s):\n`);
for (const p of problems) {
  console.error(`  ${p.file}`);
  console.error(`    ${p.rule}`);
  console.error(`    > ${p.detail}`);
  if (p.detail !== p.prose) console.error(`    in: ${p.prose}`);
  console.error("");
}
process.exit(1);
