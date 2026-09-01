/**
 * Standing audit of the question bank's exploitability and hygiene.
 *
 * Every statistical guarantee this project has ever made about the bank — the
 * answer-key spread, the longest-option bias, the Para Forming opening letter —
 * was measured by hand, written into PROJECT_CONTEXT.md as a number, and then
 * re-litigated from scratch the next time somebody doubted it. One of those
 * re-litigations turned out to be a session reading a stale snapshot, and cost a
 * full investigation to disprove. Numbers in prose rot; this file does not.
 *
 * Run with `npm run audit:bank`. Exits non-zero when a guarantee is breached, so
 * adding questions cannot quietly reintroduce a bias that was already solved.
 *
 * Everything here works on PARSED values. Never scan the raw file text: a
 * literal newline escape inside a JSON string glues its "n" onto the next word,
 * which is exactly how a British-spelling sweep once skipped a word and left
 * "programme" sitting under a heading that said "program".
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import katex from "katex";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const BANKS = [
  ["language-skills", "data/questions/language-skills.json"],
  ["quantitative-skills", "data/questions/quantitative-skills.json"],
  ["logical-reasoning", "data/questions/logical-reasoning.json"],
  ["gmat/data-insights", "data/questions/gmat/data-insights.json"],
  ["gmat/quantitative", "data/questions/gmat/quantitative.json"],
  ["gmat/verbal", "data/questions/gmat/verbal.json"],
];

const failures = [];
const notes = [];
function check(ok, message) {
  if (!ok) failures.push(message);
}

const banks = BANKS.map(([name, path]) => ({
  name,
  path,
  questions: JSON.parse(readFileSync(join(root, path), "utf8")),
}));
const all = banks.flatMap((b) => b.questions.map((q) => ({ ...q, __bank: b.name })));

const pct = (n, d) => (d === 0 ? 0 : (100 * n) / d);
const fmt = (n) => `${n.toFixed(1)}%`;

/* ------------------------------------------------------------------ hygiene */

// Anything in the C0 range except newline, which is a real feature in a prompt
// (it is how table-style questions mark a row break).
const CONTROL_CHARS = /[\u0000-\u0009\u000B-\u001F]/;

const ids = new Map();
for (const q of all) {
  if (ids.has(q.id)) failures.push(`duplicate id ${q.id} (${ids.get(q.id)} and ${q.__bank})`);
  ids.set(q.id, q.__bank);

  for (const field of ["id", "section", "topic", "difficulty", "prompt", "explanation", "source"]) {
    if (typeof q[field] !== "string" || q[field].trim() === "")
      failures.push(`${q.id}: missing or empty "${field}"`);
  }
  if (!Array.isArray(q.options) || q.options.length < 2)
    failures.push(`${q.id}: needs at least two options`);
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length)
    failures.push(`${q.id}: correctIndex ${q.correctIndex} is out of range`);
  if (new Set(q.options).size !== q.options.length)
    failures.push(`${q.id}: two options are the same string`);

  for (const [label, text] of [
    ["prompt", q.prompt],
    ["explanation", q.explanation],
    ...q.options.map((o, i) => [`option ${i}`, o]),
  ]) {
    // An odd count of "$" means a math span is unclosed, which makes KaTeX
    // swallow the rest of the string.
    if ((text.match(/\$/g) ?? []).length % 2 !== 0)
      failures.push(`${q.id}: unbalanced $ delimiter in ${label}`);
    if (text.includes("—")) failures.push(`${q.id}: em dash in ${label}`);
    if (text.includes("−")) failures.push(`${q.id}: Unicode minus in ${label}`);

    // A raw control character is never intentional and is almost always an
    // escaping accident. Writing an edit script through a shell heredoc can
    // collapse a doubled backslash, after which JSON parses the survivor as an
    // escape: a LaTeX "\times" becomes a literal TAB. That destroys the math
    // while leaving the $ delimiters balanced, so every other check here still
    // passes. It happened during this very audit pass and was caught only by
    // inspecting raw bytes.
    if (CONTROL_CHARS.test(text))
      failures.push(`${q.id}: raw control character in ${label} (an escaping accident?)`);
    if (label.startsWith("option") && text.includes("\n"))
      failures.push(`${q.id}: newline inside ${label}`);
  }

  // A bare "$" outside a math span is a currency amount that will be mis-parsed
  // as a delimiter. The bank uses the peso sign for exactly this reason.
  if (q.prompt.replace(/\$[^$]*\$/g, "").includes("$"))
    failures.push(`${q.id}: literal "$" outside a math span — use the peso sign`);

  // Every math span must actually compile. This is the check that catches the
  // corruption described above on its own, and it catches ordinary LaTeX typos
  // that would otherwise reach a candidate as a red error string mid-question.
  for (const text of [q.prompt, q.explanation, ...q.options]) {
    for (const span of text.match(/\$[^$]+\$/g) ?? []) {
      try {
        katex.renderToString(span.slice(1, -1), { throwOnError: true });
      } catch (error) {
        const first = String(error?.message ?? error).split("\n")[0];
        failures.push(`${q.id}: KaTeX cannot parse ${span} — ${first}`);
      }
    }
  }

  // Self-containment: the random 36-of-100 draw means a question that points at
  // another question can be served without it.
  const body = `${q.prompt} ${q.explanation}`.toLowerCase();
  for (const phrase of ["passage above", "passage below", "previous question", "preceding question"]) {
    if (body.includes(phrase)) failures.push(`${q.id}: refers to "${phrase}"`);
  }

  // Explanations must not name option letters: a past option shuffle left six
  // explanations pointing at the wrong letter, two of which called the correct
  // answer wrong.
  if (/\b(?:option|choice)\s*\(?[A-E]\)?\b/.test(q.explanation))
    failures.push(`${q.id}: explanation references an option letter`);
}

/* -------------------------------------------------- answer-without-reading */

/**
 * Numeric value of an option, or null when it is not a number.
 *
 * The unit stripping is deliberately greedy — any leading or trailing word, not
 * a fixed list of currencies. An option is numeric to a candidate scanning the
 * list if it reads as a number, and "2 students" or "Year 2021" reads exactly
 * that way. A narrower parser would let a question drop out of this audit by
 * having a unit word appended to it, which would quietly turn a measured bias
 * into an unmeasured one. That is not hypothetical: it happened during this
 * pass, on two questions whose keys genuinely cannot be moved to an extreme
 * (a count of students from 0 to 4 with the answer 2, and the middle year of
 * five plotted). They are counted here, honestly, as middle-key hits.
 */
function numeric(option) {
  const cleaned = option
    .replace(/[₱$,\s]/g, "")
    .replace(/^[A-Za-z]+/, "")
    .replace(/[A-Za-z%]+$/, "");
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) return Number(cleaned);
  const frac = cleaned.match(/^(-?\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  return null;
}

const rows = [];
for (const bank of [...banks, { name: "ALL", questions: all }]) {
  const qs = bank.questions;

  const slots = [0, 0, 0, 0, 0];
  for (const q of qs) slots[q.correctIndex] += 1;

  // Longest option. Restricted to prose questions, where length is a usable
  // signal; on numeric options "longest" is meaningless.
  let longestN = 0;
  let longestHit = 0;
  for (const q of qs) {
    if (q.options.some((o) => numeric(o) !== null)) continue;
    const max = Math.max(...q.options.map((o) => o.length));
    if (q.options.filter((o) => o.length === max).length !== 1) continue;
    longestN += 1;
    if (q.options[q.correctIndex].length === max) longestHit += 1;
  }

  // The middle-two heuristic: on a question whose options are all distinct
  // numbers, cross off the largest and smallest and guess between what is left.
  // Distractors built by nudging the answer up AND down bracket it structurally,
  // which turns a 25% blind guess into a 50% one.
  //
  // Correcting that by pushing every key to an extreme would just mint a new
  // one-line strategy ("always pick the largest"), so the two extremes are
  // tracked separately and each is held near its own 25% chance.
  let midN = 0;
  let midHit = 0;
  let maxHit = 0;
  let minHit = 0;
  for (const q of qs) {
    const values = q.options.map(numeric);
    if (values.some((v) => v === null)) continue;
    if (new Set(values).size !== values.length) continue;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = sorted.indexOf(values[q.correctIndex]);
    midN += 1;
    if (rank > 0 && rank < values.length - 1) midHit += 1;
    else if (rank === values.length - 1) maxHit += 1;
    else minHit += 1;
  }

  rows.push({
    name: bank.name,
    n: qs.length,
    slots,
    longest: [longestHit, longestN],
    mid: [midHit, midN],
    extremes: [minHit, maxHit, midN],
  });
}

console.log("\nQuestion bank audit\n" + "=".repeat(72));

console.log("\nAnswer-key slot distribution");
for (const r of rows) {
  const spread = r.slots.map((c) => fmt(pct(c, r.n)).padStart(6)).join(" ");
  console.log(`  ${r.name.padEnd(20)} n=${String(r.n).padStart(3)}  ${spread}`);
}

console.log("\nKey is the longest option (prose questions only) — chance is 25%");
for (const r of rows) {
  const [hit, n] = r.longest;
  console.log(
    `  ${r.name.padEnd(20)} ${String(hit).padStart(3)}/${String(n).padEnd(4)} ${fmt(pct(hit, n))}`
  );
}

console.log("\nWhere the key sits among numeric options — chance is 25 / 50 / 25");
for (const r of rows) {
  const [lo, hi, n] = r.extremes;
  console.log(
    `  ${r.name.padEnd(20)} smallest ${fmt(pct(lo, n)).padStart(6)}` +
      `   middle ${fmt(pct(r.mid[0], n)).padStart(6)}` +
      `   largest ${fmt(pct(hi, n)).padStart(6)}   (n=${n})`
  );
}

/* ------------------------------------------------- per-topic slot clustering */

/*
 * The bank-wide slot spread can look perfect while a single topic is loaded
 * entirely onto one slot — and a candidate practices ONE TOPIC AT A TIME.
 *
 * This is not hypothetical. Options are never shuffled at runtime: the draw
 * shuffles which QUESTIONS you get, never the options inside one, so the stored
 * order is exactly what every candidate sees on every attempt. Before this check
 * existed, Para Forming keyed the last option in 8 of 10 (click the fourth
 * without reading, score 80% on the topic) and Critical Reasoning: Weaken keyed
 * the second in 4 of 4, while every per-file number looked healthy.
 *
 * Data Sufficiency is exempt and must stay exempt: its five options are a fixed
 * memorized order on the real exam, deliberately identical across every DS
 * question, so they cannot be re-slotted without training the wrong habit.
 */
const SLOT_EXEMPT_TOPICS = new Set(["Data Sufficiency"]);
const topicSlots = new Map();
for (const q of all) {
  if (SLOT_EXEMPT_TOPICS.has(q.topic)) continue;
  const key = `${q.__bank} / ${q.topic}`;
  if (!topicSlots.has(key)) topicSlots.set(key, []);
  topicSlots.get(key).push(q.correctIndex);
}

const clustered = [];
for (const [key, slots] of topicSlots) {
  // Under 4 questions any distribution looks lopsided and means nothing.
  if (slots.length < 4) continue;
  const counts = new Map();
  for (const slot of slots) counts.set(slot, (counts.get(slot) ?? 0) + 1);
  const [slot, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
  const share = pct(count, slots.length);
  clustered.push({ key, slot, count, n: slots.length, share });
}
clustered.sort((a, b) => b.share - a.share);

console.log("\nMost concentrated topics (which slot the key sits in)");
for (const c of clustered.slice(0, 5)) {
  console.log(
    `  ${c.key.padEnd(46)} slot ${c.slot + 1}: ${c.count}/${c.n} (${fmt(c.share)})`
  );
}

for (const c of clustered) {
  if (c.share <= 50) continue;
  failures.push(
    `${c.key}: the key is in slot ${c.slot + 1} for ${c.count} of ${c.n} questions (${fmt(
      c.share
    )}) — answerable without reading`
  );
}

/* --------------------------------------------------------- British spelling */

/*
 * The v2.0.2 sweep covered the -our / -ise / -re families and still missed
 * "catalogued", because -logue belongs to none of them; one occurrence survived
 * in 390 questions until an audit happened to read it.
 *
 * Stems rather than an enumerated word list, which is what let "labour" through
 * once before. Words that are legitimately -our in American English (four, hour,
 * tour, pour, flour, contour, devour) are simply absent from the stem list.
 */
const BRITISH = [
  // Only the catalog family. A blanket -logue rule would be wrong: "dialogue"
  // and "monologue" are standard American English, while "catalogue" is the
  // British variant of "catalog". This is the word that slipped past the v2.0.2
  // sweep, seven times inside one question.
  [/\bcatalogu(?:e|es|ed|ing)\b/i, "catalogue: use catalog / cataloged"],
  [/\b\w*(?:lab|col|fav|neighb|behavi|hono|hum|rum|vig|end|harb)our\w*\b/i, "-our: use -or"],
  [/\bwhilst\b/i, "whilst: use while"],
  [/\bdefence\b/i, "defence: use defense"],
  [/\banalys(?:e|ed|es|ing)\b/i, "analyse: use analyze"],
  [/\bprogramme\b/i, "programme: use program"],
  [/\bgrey\b/i, "grey: use gray"],
  [/\bjudgement\b/i, "judgement: use judgment"],
  [/\bpractis(?:e|ed|ing)\b/i, "practise (verb): use practice"],
  [/\b(?:centre|metre|litre|theatre|fibre)s?\b/i, "-re: use -er"],
  [/\b(?:kilo|centi|milli)metres?\b/i, "-metre: use -meter"],
  [/\b(?:travell|cancell|modell|signall|labell)(?:ed|ing)\b/i, "doubled l: use a single l"],
];
for (const q of all) {
  for (const [label, text] of [
    ["prompt", q.prompt],
    ["explanation", q.explanation],
    ...q.options.map((o, i) => [`option ${i}`, o]),
  ]) {
    for (const [re, name] of BRITISH) {
      const hit = text.match(re);
      if (hit) failures.push(`${q.id}: British spelling "${hit[0]}" in ${label} (${name})`);
    }
  }
}

/* ------------------------------------------------------------- the contract */

const total = rows.at(-1);

for (const r of rows.slice(0, -1)) {
  /*
   * Every file, not only the large ones.
   *
   * This check used to skip anything under 100 questions, on the reasoning that
   * a sample of 30 is too noisy to judge. That exemption let a real regression
   * through: a re-slotting pass pushed GMAT Quantitative to 17 keys of 30 in
   * slot A (56.7%, p = 2e-4 against chance) and the audit reported OK, because
   * that file has 30 questions. "Too small to judge precisely" is not the same
   * as "too small to judge at all" — 56.7% is far outside anything sampling
   * noise produces.
   *
   * The band widens for small files instead of vanishing.
   */
  const [lo, hi] = r.n >= 100 ? [14, 36] : [10, 42];
  r.slots.slice(0, 4).forEach((c, i) => {
    const p = pct(c, r.n);
    if (p < lo || p > hi)
      failures.push(
        `${r.name}: slot ${i + 1} is the key ${fmt(p)} of the time (want ${lo}-${hi}% at n=${r.n})`
      );
  });
}

const [longHit, longN] = total.longest;
check(
  pct(longHit, longN) <= 33,
  `longest-option heuristic scores ${fmt(pct(longHit, longN))} bank-wide (want <=33%)`
);

const [midHit, midN] = total.mid;
check(
  pct(midHit, midN) <= 68,
  `middle-two heuristic scores ${fmt(pct(midHit, midN))} bank-wide (want <=68%, chance is 50%)`
);

const [minHit, maxHit] = total.extremes;
check(
  pct(maxHit, midN) <= 38,
  `"always pick the largest" scores ${fmt(pct(maxHit, midN))} bank-wide (want <=38%, chance is 25%)`
);
check(
  pct(minHit, midN) <= 38,
  `"always pick the smallest" scores ${fmt(pct(minHit, midN))} bank-wide (want <=38%, chance is 25%)`
);

for (const b of banks) {
  const mix = { easy: 0, medium: 0, hard: 0 };
  for (const q of b.questions) {
    if (!(q.difficulty in mix)) failures.push(`${b.name}: unknown difficulty "${q.difficulty}"`);
    else mix[q.difficulty] += 1;
  }
  notes.push(`${b.name}: ${mix.easy} easy / ${mix.medium} medium / ${mix.hard} hard`);
  // An empty tier strands the adaptive ladder, which walks up and down them.
  if (mix.easy === 0 || mix.medium === 0 || mix.hard === 0)
    failures.push(`${b.name}: a difficulty tier is empty, which strands the adaptive ladder`);
}

console.log("\nDifficulty mix");
for (const n of notes) console.log(`  ${n}`);

console.log("\n" + "=".repeat(72));
if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):\n`);
  for (const f of failures) console.error(`  x ${f}`);
  console.error("");
  process.exit(1);
}
console.log(`\nOK — ${all.length} questions across ${banks.length} banks.\n`);
