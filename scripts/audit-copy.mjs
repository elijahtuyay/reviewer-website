/**
 * npm run audit:copy — checks user-facing prose against the ASD-STE100 rules
 * this project writes to.
 *
 * WHY THIS IS A SCRIPT AND NOT A PARAGRAPH IN A DOC. Every other style rule
 * this repo has stated in prose has drifted: copy claimed a section lock that
 * did not exist for months, and PROJECT_CONTEXT.md has produced three separate
 * stale notes. A rule nothing checks is a rule that lapses on the next commit.
 * So the ASD-STE100 rules that are mechanically decidable are decided
 * mechanically, and the script exits non-zero when one breaks.
 *
 * What it checks:
 *   1. No semicolon in prose (STE Rule 8.1 bans the mark outright).
 *   2. Simple tenses only. No perfect ("you have used") and no progressive
 *      ("the timer is running") verb forms.
 *   3. Sentence length: 25 words for descriptive text, 20 for an instruction.
 *   4. A banned list of phrasal verbs and idioms (Rule 9.3), plus the
 *      one-word-one-meaning synonyms this project has settled.
 *
 * What it deliberately does NOT check: whether a word is in ASD's ~900-word
 * approved dictionary. That dictionary is not redistributable and the official
 * PDF is encrypted, so any list here would be guesswork wearing a checkmark.
 * Rule 3.7 (use the verb, not the noun made from it) is left to the author for
 * the same reason: deciding it needs the dictionary.
 *
 * THE FIRST VERSION OF THIS SCRIPT PASSED WHILE READING ALMOST NOTHING, and
 * that is the failure worth remembering. Its JSX pass matched text between a
 * `>` and a `<`, and its filters then discarded any string containing `{`. So
 * every paragraph interrupted by an interpolation — the hero, the section lock
 * screen, the calculator bullets, the whole setup-page intro — was silently
 * exempt. It reported "no findings" over copy that said "{n} wrong" in
 * SectionNav, breaking two of the five settled terms at once.
 *
 * Three things now stop a repeat, and all three are load-bearing:
 *
 *   - Interpolations are collapsed to the placeholder "N" INSIDE a captured
 *     text run, never across the file (see the note at the JSX pass, which
 *     records what collapsing globally actually does).
 *   - A file that yields zero strings and is not on NO_PROSE_EXPECTED is a
 *     FAILURE, not a quiet pass.
 *   - The run says how many strings it inspected. A coverage collapse then
 *     shows up as a number that moved, instead of reading as a clean run.
 *
 * The word floor is TWO words, not three. Three looks like the safer choice and
 * is not: "{n} wrong" and "{n} skipped" both collapse to two words, and those
 * were the only real vocabulary breaches in the app. Dropping to two added 44
 * strings and no false positives, because class lists and identifiers are
 * already filtered by other means.
 *
 * SCOPE. Files are discovered, not listed, because a hand-kept list is the same
 * drift mechanism this script exists to stop — the original shipped already
 * missing `components/Timer.tsx`. Question-bank content is out of scope on
 * purpose: a Language Skills question about the present perfect has to be able
 * to contain the present perfect.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Everything under these carries user-facing copy, plus the lib files that do. */
const ROOTS = ["app", "components"];

/*
 * The exam modules are DISCOVERED, not listed.
 *
 * They were listed once, and adding the GRE made the list wrong the same day:
 * a whole exam's description, six section descriptions and its `notes` were
 * invisible to this audit while it reported "no findings". That is precisely
 * the drift the app/ and components/ walk exists to prevent, so the same
 * treatment applies here. A new exam is now covered the moment it exists.
 */
const EXTRA_FILES = [
  "lib/site.ts",
  ...readdirSync(join(root, "lib/exams"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => `lib/exams/${e.name}/index.ts`)
    .filter((rel) => existsSync(join(root, rel))),
];

/**
 * Files with no user-facing prose. Listed rather than silently tolerated, so
 * "this file yielded nothing" is a claim someone made on purpose. Any other
 * discovered file that yields zero strings FAILS the audit: that means the
 * extractor stopped seeing the file, which is exactly how the first version of
 * this script passed while checking almost nothing.
 */
const NO_PROSE_EXPECTED = new Set([
  "app/robots.ts",
  "app/sitemap.ts",
  "app/api/auth/[...all]/route.ts",
  "app/[examId]/layout.tsx",
  "app/[examId]/quiz/[section]/layout.tsx",
  "components/MathSpan.tsx",
  "components/MathText.tsx",
  "components/PageTransition.tsx",
  "components/ThemeInitScript.tsx",
  "components/quiz/useAttempt.ts",
  // Both carry only short labels and prop-supplied text, no prose of their own.
  "components/ConfirmDialog.tsx",
  "components/SiteHeader.tsx",
]);

const MAX_WORDS_DESCRIPTIVE = 25;
const MAX_WORDS_INSTRUCTION = 20;

/**
 * Perfect and progressive forms. Written as auxiliary + participle/gerund
 * rather than as a word list, because the auxiliary alone is fine: "you have
 * three changes left" is simple present and must not be flagged.
 *
 * The adverbs allowed between the two halves are enumerated. Without `not` and
 * `never`, "has not started" walked straight through the first version.
 */
const BETWEEN = "(?:(?:not|never|already|just|only|also|still|now|always|\\w+ly)\\s+){0,2}";

/** Irregular past participles plus the regular -ed case. `been` covers "has been". */
const PARTICIPLES =
  "been|done|gone|run|begun|written|taken|given|seen|made|kept|left|read|lost|come|become|held|" +
  "sent|spent|met|drawn|shown|known|chosen|put|set|found|got|gotten|built|brought|thought|" +
  "understood|paid|said|told|won|\\w+ed";

/**
 * -ing words that are nouns, not gerunds. Without them the progressive rule
 * flags "It is nothing" and "during the section", which is the kind of false
 * positive that teaches the next reader to skim the whole script.
 */
const NOT_GERUNDS =
  "nothing|something|anything|everything|during|morning|evening|string|thing|king|ring|spring";

const TENSE_RULES = [
  {
    label: "perfect tense (use the simple past)",
    re: new RegExp(
      `\\b(?:have|has|had|haven't|hasn't|hadn't)\\s+${BETWEEN}(?:${PARTICIPLES})\\b`,
      "i"
    ),
  },
  {
    label: "progressive tense (use the simple present)",
    re: new RegExp(
      `\\b(?:am|is|are|was|were|be|been|being|isn't|aren't|wasn't|weren't)\\s+${BETWEEN}(?!(?:${NOT_GERUNDS})\\b)\\w+ing\\b`,
      "i"
    ),
  },
];

/**
 * Phrasal verbs, idioms, and the synonyms this project has settled against.
 *
 * The vocabulary entries are NOT ASD-STE100 rules and are labeled so. They are
 * STE's one-word-one-meaning rule applied to this project's own dictionary,
 * which is the part of the standard a project is expected to supply itself.
 */
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
  [/\bstart(s|ed)?\s+(?:\w+\s+){0,3}over\b/i, 'phrasal verb: say "restart"'],
  [/\bran?\s+out\s+of\s+time\b/i, 'idiom: say "the time ended"'],
  [/\bout\s+of\s+date\b/i, 'idiom: say "old"'],
  [/\bout\s+of\s+reach\b/i, 'idiom: say "not available"'],
  [/\btime\s+to\s+spare\b/i, 'idiom: say "time remains"'],
  [/\bthe\s+real\s+thing\b/i, 'idiom: say "the real exam"'],
  [/\bthe\s+clock\b/i, 'one word per concept: this project says "timer"'],
  // Bare, not the "wrong answer" bigram. The narrow version is what let
  // SectionNav's "{n} wrong" ship inside a run that reported no findings.
  [/\bwrong\b/i, 'one word per concept: this project says "incorrect"'],
  [/\bskipped\b/i, 'one word per concept: this project says "no answer"'],
];

/**
 * A sentence is an instruction if it opens with an imperative or tells the
 * reader what they must do. STE caps those at 20 words rather than 25.
 */
const IMPERATIVE_OPENERS =
  /^(?:select|press|read|take|answer|open|close|start|submit|finish|clear|undo|watch|use|do not|don't|never|always|give|go|return|reload|keep|flag|change|add)\b/i;
const MODAL_INSTRUCTION = /\byou (?:must|cannot|can't|should)\b/i;

function isInstruction(sentence) {
  return IMPERATIVE_OPENERS.test(sentence.trim()) || MODAL_INSTRUCTION.test(sentence);
}

/** Every .ts/.tsx under the roots, plus the explicit lib files. */
function discoverFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir))) {
      const rel = `${dir}/${entry}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry)) out.push(rel);
    }
  };
  for (const r of ROOTS) walk(r);
  out.push(...EXTRA_FILES);
  return out.sort();
}

/**
 * Pull prose out of a source file.
 *
 * Comments go first, because they are full of English sentences that are not
 * copy and would bury a real finding. Then className/style attributes.
 *
 * Interpolations are then collapsed to the placeholder word "N" rather than
 * used as grounds to discard the string. That is the whole difference between
 * this version and the one that read almost nothing: a paragraph broken by
 * `{exam.label}` is still a paragraph, and it is the one the reader sees whole.
 */
function extractProse(source) {
  const text = source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/\bclassName=(?:"[^"]*"|\{`[^`]*`\}|\{[^}]*\})/g, " ")
    .replace(/\bstyle=\{\{[\s\S]*?\}\}/g, " ")
    .replace(/\b(?:srLabel|href|id|key|type|role|import|from)\s*[:=]\s*"[^"]*"/g, " ");

  const found = [];

  /*
   * String literals, before interpolations are collapsed, so a string inside a
   * ternary branch is still inspected on its own.
   *
   * THE LOOKAROUNDS ARE LOAD-BEARING. A bare `"..."` pattern pairs quotes in
   * scan order, so one mis-paired match — a CLOSING quote joined to the next
   * OPENING quote — consumes everything between them and the `g` flag resumes
   * past it. That silently ate the whole ConfirmDialog block at the end of
   * FreeFormRunner and SequentialRunner, including "Start this section over?",
   * which the phrasal-verb rule would otherwise have caught. Requiring a
   * plausible delimiter before the opening quote and after the closing one
   * makes such a pairing unmatchable, and the lookarounds consume nothing, so
   * a failed attempt cannot skip a real literal that follows.
   */
  const OPENS = "(?<=^|[=({\\[,:?\\s>])";
  const CLOSES = "(?=[)\\]},;:?\\s<]|$)";
  for (const quote of ['"', "'", "`"]) {
    const body = quote === "`" ? "(?:[^`\\\\]|\\\\.)" : `(?:[^${quote}\\\\\\n]|\\\\.)`;
    const re = new RegExp(`${OPENS}${quote}(${body}{12,})${quote}${CLOSES}`, "g");
    for (const m of text.matchAll(re)) found.push(m[1]);
  }

  /*
   * Now the JSX text nodes.
   *
   * The run is captured FIRST and its interpolations are replaced afterwards,
   * within the run. Collapsing braces across the whole file first looks
   * equivalent and is not: iterate that to a fixpoint and the outermost pair
   * eaten is the component function's own body, which deletes every JSX node in
   * the file. That mistake took this script from 143 strings to 99 and reported
   * eight files as having no copy at all.
   *
   * A JSX text node cannot contain `<` or `>`, so the run boundaries are safe,
   * and any braces inside one belong to that run.
   */
  for (const m of text.matchAll(/>([^<>]{12,})</g)) {
    let run = m[1].replace(/\{["'` ]+\}/g, " ");
    for (let i = 0; i < 4; i += 1) run = run.replace(/\{[^{}]*\}/g, " N ");
    found.push(run);
  }

  return (
    found
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
      .filter((s) => s.split(" ").length >= 2)
      .filter((s) => !/^[a-z-]+(\s+[a-z0-9:./[\]-]+)+$/.test(s))
      // Leftover markup and operators.
      .filter((s) => !/[<>{}]|=|&&|\|\||\/\//.test(s))
      /*
       * Code the JSX pass swept up. The discriminator is punctuation with no
       * space after it: prose always puts a space after a period or a comma, so
       * `exam.id` and `t.total` are code while "8 digits. Above 99,999,999" is
       * not. `useRef<HTMLElement | null>(null); const` reads exactly like a
       * text node between a > and a <, and produced ten of this script's first
       * thirteen findings.
       */
      .filter((s) => !/[.,][a-zA-Z]/.test(s))
      .filter(
        (s) =>
          !/\b(?:const|let|return|null|await|function|useRef|useState|props|className|import|export|class|extends|Component)\b/.test(s)
      )
  );
}

const problems = [];
let filesRead = 0;
let totalStrings = 0;

for (const rel of discoverFiles()) {
  const prose = extractProse(readFileSync(join(root, rel), "utf8"));
  filesRead += 1;
  totalStrings += prose.length;

  if (prose.length === 0 && !NO_PROSE_EXPECTED.has(rel)) {
    problems.push({
      file: rel,
      rule: "Coverage: no prose extracted from a file that is not on NO_PROSE_EXPECTED",
      detail:
        "Either this file genuinely has no copy (add it to the list, on purpose) or the extractor stopped seeing it.",
      prose: "",
    });
  }

  for (const line of prose) {
    const flag = (rule, detail) => problems.push({ file: rel, rule, detail, prose: line });

    if (line.includes(";")) flag("Rule 8.1: no semicolon", line);

    for (const { label, re } of TENSE_RULES) {
      const hit = line.match(re);
      if (hit) flag(`Simple tenses only: ${label}`, hit[0]);
    }

    for (const [re, why] of BANNED) {
      const hit = line.match(re);
      if (hit) flag(`Word choice: ${why}`, hit[0]);
    }

    // Split on terminal punctuation followed by a capital, so "8 digits. Above
    // 99,999,999" splits and "GMAC (the ...)" does not.
    for (const sentence of line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/)) {
      const trimmed = sentence.trim();
      const words = trimmed.split(/\s+/).filter(Boolean);
      const instruction = isInstruction(trimmed);
      const limit = instruction ? MAX_WORDS_INSTRUCTION : MAX_WORDS_DESCRIPTIVE;
      if (words.length > limit) {
        flag(
          `Sentence length: ${words.length} words, ${
            instruction ? "instruction" : "descriptive"
          } limit ${limit}`,
          trimmed
        );
      }
    }
  }
}

const summary = `${filesRead} files, ${totalStrings} strings inspected`;

if (problems.length === 0) {
  console.log(`audit:copy — ${summary}, no findings.`);
  process.exit(0);
}

console.error(`audit:copy — ${summary}, ${problems.length} finding(s):\n`);
for (const p of problems) {
  console.error(`  ${p.file}`);
  console.error(`    ${p.rule}`);
  if (p.detail) console.error(`    > ${p.detail}`);
  if (p.prose && p.detail !== p.prose) console.error(`    in: ${p.prose}`);
  console.error("");
}
process.exit(1);
