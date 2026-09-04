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
  ["gre/verbal", "data/questions/gre/verbal.json"],
  ["gre/quantitative", "data/questions/gre/quantitative.json"],
];

/*
 * THREE QUESTION KINDS, and most of the statistics below only mean anything for
 * one of them.
 *
 * "single" is an option index, and every heuristic here was written for it.
 * "multi" has a set of correct indices, so "which slot holds the key" has no
 * single answer. "numeric" has no options at all, so slot spread, longest
 * option and the middle-two test are all undefined rather than merely unusual.
 *
 * They are therefore EXCLUDED from those samples rather than crashing them or,
 * worse, silently counting `undefined` as slot 0 and reporting a bias that does
 * not exist. Their own integrity is checked separately, below.
 */
/*
 * Types whose option set is FIXED and memorized on the real exam. Two separate
 * heuristics have to skip them, which is why this sits with the helpers rather
 * than beside either one.
 *
 * Data Sufficiency (GMAT) and Quantitative Comparison (GRE) both present the
 * same options in the same order on every question of the type. Re-slotting
 * them would train a habit that fails on test day, so the per-topic slot check
 * skips them. The longest-option check has to skip them too, for a subtler
 * reason: the same option is always the longest string, so every time it
 * happens to be the answer the heuristic scores a "hit" that tells a candidate
 * nothing they could ever act on.
 */
const SLOT_EXEMPT_TOPICS = new Set(["Data Sufficiency", "Quantitative Comparison"]);

const kindOf = (q) => q.kind ?? "single";
const isSingle = (q) => kindOf(q) === "single";
const optionsOf = (q) => (Array.isArray(q.options) ? q.options : []);

const failures = [];
const notes = [];

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
  const kind = kindOf(q);
  if (!["single", "multi", "numeric"].includes(kind))
    failures.push(`${q.id}: unknown kind "${kind}"`);

  if (kind === "numeric") {
    // No options at all. The answer is typed, so the only thing to validate is
    // that there is a finite value to mark it against.
    if (typeof q.correctValue !== "number" || !Number.isFinite(q.correctValue))
      failures.push(`${q.id}: numeric question needs a finite correctValue`);
    if (q.options !== undefined) failures.push(`${q.id}: numeric question must not carry options`);
    if (q.tolerance !== undefined && !(q.tolerance >= 0))
      failures.push(`${q.id}: tolerance must be zero or greater`);
  } else {
    if (!Array.isArray(q.options) || q.options.length < 2)
      failures.push(`${q.id}: needs at least two options`);
    if (new Set(optionsOf(q)).size !== optionsOf(q).length)
      failures.push(`${q.id}: two options are the same string`);
  }

  if (kind === "single") {
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= optionsOf(q).length)
      failures.push(`${q.id}: correctIndex ${q.correctIndex} is out of range`);
  }

  if (kind === "multi") {
    const indices = q.correctIndices;
    if (!Array.isArray(indices) || indices.length === 0) {
      failures.push(`${q.id}: multi question needs a non-empty correctIndices`);
    } else {
      if (new Set(indices).size !== indices.length)
        failures.push(`${q.id}: correctIndices repeats an index`);
      for (const i of indices) {
        if (!Number.isInteger(i) || i < 0 || i >= optionsOf(q).length)
          failures.push(`${q.id}: correctIndices entry ${i} is out of range`);
      }
      // The count the UI prints and the count the marker requires have to be
      // the same number. A question that says "select exactly 2" and keys three
      // options is unanswerable, and nothing else here would catch it.
      if (q.selectExactly != null && q.selectExactly !== indices.length)
        failures.push(
          `${q.id}: selectExactly is ${q.selectExactly} but ${indices.length} options are keyed`
        );
      /*
       * Only for a FIXED-COUNT multi-select.
       *
       * On Sentence Equivalence, which says "select exactly 2", keying every
       * option would make the question a formality. On the GRE's open "select
       * all that apply", all three statements being true is a legitimate and
       * genuinely occurring case, and forbidding it would itself become
       * exploitable: a candidate who knows the answer is never all three has
       * been handed information the real exam does not give them.
       */
      if (q.selectExactly != null && indices.length >= optionsOf(q).length)
        failures.push(`${q.id}: every option is keyed, so there are no distractors`);
    }
    if (q.correctIndex !== undefined)
      failures.push(`${q.id}: multi question must not also carry correctIndex`);
  }

  for (const [label, text] of [
    ["prompt", q.prompt],
    ["explanation", q.explanation],
    ...optionsOf(q).map((o, i) => [`option ${i}`, o]),
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

    /*
     * A LITERAL backslash-n, which reaches the screen as two characters.
     *
     * `MathText` splits on a real newline. 32 GRE quantitative prompts stored
     * the two-character form, so a third of that section rendered
     * "10 pi.\\nQuantity A:" to the candidate. The raw-control-character check
     * above cannot see it, because a backslash and an n are both ordinary
     * printable characters.
     *
     * The cause was an authoring instruction that asked for "a real
     * two-character backslash-n in the JSON string", which is precisely the
     * broken form. \\t and \\r are included because the same slip produces them.
     */
    // OUTSIDE math spans only. Inside one a backslash starts a LaTeX
    // command, and \times, \neq and \right all match a naive test:
    // that version produced 93 false positives across the existing banks.
    if (/\\[nrt]/.test(text.replace(/\$[^$]*\$/g, " ")))
      failures.push(
        `${q.id}: literal backslash-escape in ${label} — it prints as text, use a real newline`
      );
  }

  // A bare "$" outside a math span is a currency amount that will be mis-parsed
  // as a delimiter. The bank uses the peso sign for exactly this reason.
  if (q.prompt.replace(/\$[^$]*\$/g, "").includes("$"))
    failures.push(`${q.id}: literal "$" outside a math span — use the peso sign`);

  // Every math span must actually compile. This is the check that catches the
  // corruption described above on its own, and it catches ordinary LaTeX typos
  // that would otherwise reach a candidate as a red error string mid-question.
  for (const text of [q.prompt, q.explanation, ...optionsOf(q)]) {
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
  for (const q of qs) if (isSingle(q)) slots[q.correctIndex] += 1;

  // Longest option. Restricted to prose questions, where length is a usable
  // signal; on numeric options "longest" is meaningless.
  let longestN = 0;
  let longestHit = 0;
  for (const q of qs) {
    if (!isSingle(q)) continue;
    // A fixed, memorized option set has the same longest string on every
    // question of the type. On Quantitative Comparison "the relationship cannot
    // be determined from the information given" is always the longest, so every
    // time it is the answer this heuristic scores a hit that tells a candidate
    // nothing they could act on.
    if (SLOT_EXEMPT_TOPICS.has(q.topic)) continue;
    if (optionsOf(q).some((o) => numeric(o) !== null)) continue;
    const max = Math.max(...optionsOf(q).map((o) => o.length));
    if (optionsOf(q).filter((o) => o.length === max).length !== 1) continue;
    longestN += 1;
    if (optionsOf(q)[q.correctIndex].length === max) longestHit += 1;
  }

  /*
   * The same bias one rank lower down.
   *
   * "Is the key THE longest option" is a single question, and a bank can pass
   * it while a candidate who guesses between the two longest still beats
   * chance by half again. GMAT Verbal did exactly that: the key was the
   * longest 26.2% of the time (chance 20%, comfortably inside the band) while
   * sitting in the top two 58.0% of the time against a chance rate of 40%.
   *
   * It passed because two opposite artifacts cancelled. The 60 newly written
   * questions keyed the longest option 40.7% of the time; the 30 that had a
   * fifth option added later keyed it 0% of the time, because the added
   * distractor was usually the longest string in the question. A file average
   * hid both.
   *
   * Ties at the boundary are skipped rather than resolved: if the second and
   * third longest options are the same length there is no "top two" for a
   * candidate to pick out by eye.
   */
  let top2N = 0;
  let top2Hit = 0;
  for (const q of qs) {
    if (!isSingle(q)) continue;
    if (SLOT_EXEMPT_TOPICS.has(q.topic)) continue;
    if (optionsOf(q).some((o) => numeric(o) !== null)) continue;
    const lens = optionsOf(q).map((o) => o.length);
    if (lens.length < 4) continue;
    const sorted = [...lens].sort((a, b) => b - a);
    if (sorted[1] === sorted[2]) continue;
    top2N += 1;
    if (optionsOf(q)[q.correctIndex].length >= sorted[1]) top2Hit += 1;
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
    if (!isSingle(q)) continue;
    const values = optionsOf(q).map(numeric);
    if (values.length === 0 || values.some((v) => v === null)) continue;
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
    /*
     * The denominator for the slot spread is the number of questions that HAVE
     * a slot, not the size of the file.
     *
     * Only single-choice questions carry a `correctIndex`. Measuring five slot
     * counts against a file that also holds multi-select and numeric-entry
     * questions makes every slot look under-used: GRE Verbal is 31 single of
     * 48, so a perfectly even spread reads as 12.9% per slot against a floor of
     * 10%, and one more multi-select question would fail a bank that is not
     * biased at all.
     */
    singleN: qs.filter(isSingle).length,
    slots,
    longest: [longestHit, longestN],
    top2: [top2Hit, top2N],
    mid: [midHit, midN],
    extremes: [minHit, maxHit, midN],
    /*
     * How many options this bank's questions actually offer.
     *
     * Every threshold below used to be a literal calibrated on four options,
     * and five of the eight banks now have five. A blind guess on those is 20%,
     * not 25%, so a band of "up to 38%" read as 1.5x chance and was really
     * 1.9x, and the printed labels said "chance is 25%" under numbers where it
     * was not. Take the mode rather than the max: NMAT Quantitative has eleven
     * five-option questions among eighty-nine four-option ones, and it is a
     * four-option bank.
     */
    optCount: (() => {
      const counts = new Map();
      for (const q of qs) {
        if (!isSingle(q)) continue;
        const k = optionsOf(q).length;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
      let best = 4;
      let bestN = -1;
      for (const [k, c] of counts) if (c > bestN) [best, bestN] = [k, c];
      return best;
    })(),
  });
}

console.log("\nQuestion bank audit\n" + "=".repeat(72));

console.log("\nAnswer-key slot distribution");
for (const r of rows) {
  const spread = r.slots.map((c) => fmt(pct(c, r.singleN)).padStart(6)).join(" ");
  const label = r.singleN === r.n ? `n=${String(r.n).padStart(3)}` : `n=${String(r.singleN).padStart(3)}*`;
  console.log(`  ${r.name.padEnd(20)} ${label}  ${spread}`);
}

console.log("\nKey is the longest option (prose questions only)");
for (const r of rows) {
  const [hit, n] = r.longest;
  console.log(
    `  ${r.name.padEnd(20)} ${String(hit).padStart(3)}/${String(n).padEnd(4)} ${fmt(pct(hit, n))}`
  );
}

console.log("\nKey is one of the two longest options (prose questions only)");
for (const r of rows) {
  const [hit, n] = r.top2;
  const chance = n ? fmt((200 / r.optCount)) : "n/a";
  console.log(
    `  ${r.name.padEnd(20)} ${fmt(pct(hit, n)).padStart(6)}  (${hit}/${n}, chance ${chance})`
  );
}

console.log("\nWhere the key sits among numeric options (chance is 1 / n-2 / 1 over n)");
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
const topicSlots = new Map();
for (const q of all) {
  if (SLOT_EXEMPT_TOPICS.has(q.topic)) continue;
  if (!isSingle(q)) continue;
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

/*
 * The same argument as the slot check above, applied to option LENGTH.
 *
 * A per-bank length average hides a loaded topic exactly the way a per-file
 * slot average hid Para Forming keying the last option 8 times in 10. Measured
 * when this check was added: GRE Verbal Reading Comprehension keyed the
 * SHORTEST option 14 of 30 times, 46.7% against a 20% chance rate, +3.7 SE,
 * while the bank it lives in read 20.0% overall and passed comfortably.
 *
 * Both directions are measured, because a floor and a ceiling catch different
 * habits and this project has now created BOTH. Long hedged keys beside curt
 * distractors is the familiar one. Its mirror shows up on Reading
 * Comprehension, where the correct answer to a "primary purpose" stem is the
 * most minimal claim the passage supports and every distractor carries the
 * extra clause that makes it wrong, so the key is naturally the shortest
 * string. "Naturally" does not help the candidate who has noticed.
 *
 * A tie at the boundary is skipped rather than resolved: if two options share
 * the longest or shortest length there is nothing for a candidate to pick out
 * by eye.
 */
const topicLengths = new Map();
for (const q of all) {
  if (SLOT_EXEMPT_TOPICS.has(q.topic)) continue;
  if (!isSingle(q)) continue;
  const opts = optionsOf(q);
  if (opts.length === 0) continue;
  if (opts.some((o) => numeric(o) !== null)) continue;
  if (opts.length < 4) continue;
  /*
   * Measured at BOTH the sub-topic and the family it belongs to.
   *
   * The floor of eight is statistically right and it was also a hole, because
   * this bank names topics at two levels: "Critical Reasoning: Weaken" and
   * "Critical Reasoning: Assumption" are separate strings. Splitting one topic
   * finely enough makes any bias in it invisible to a per-topic check, and a
   * review lane demonstrated exactly that by relabelling the 30 biased GRE
   * Reading Comprehension questions into six sub-topics: the same +3.7 SE
   * breach vanished, with not even a watch line.
   *
   * That is not hypothetical here. NMAT Logical Reasoning's Critical Reasoning
   * family is 19 questions across four sub-topics, none of which reaches eight
   * on its own, so the whole family was unjudged — and Critical Reasoning is
   * precisely the topic this project already records hitting 94.7% on the
   * longest-option heuristic.
   *
   * Rolling up does not replace the sub-topic measurement, it adds to it. A
   * bias confined to one sub-topic large enough to judge still shows there.
   */
  const family = q.topic.includes(": ") ? q.topic.split(": ")[0] : null;
  const scopes = [`${q.__bank} / ${q.topic}`];
  if (family) scopes.push(`${q.__bank} / ${family} (all)`);

  const lens = opts.map((o) => o.length);
  const keyLen = opts[q.correctIndex].length;
  const top = Math.max(...lens);
  const bottom = Math.min(...lens);
  const sorted = [...lens].sort((a, b) => a - b);

  for (const key of scopes) {
    if (!topicLengths.has(key))
      topicLengths.set(key, {
        bank: q.__bank,
        options: [],
        longest: [0, 0],
        shortest: [0, 0],
        bottom2: [0, 0],
      });
    const rec = topicLengths.get(key);
    /*
     * Chance comes from the questions actually in the sample, not the bank's
     * modal option count. They agree everywhere today, and would not for a
     * four-option topic inside a five-option bank.
     */
    rec.options.push(opts.length);
    if (lens.filter((l) => l === top).length === 1) {
      rec.longest[1] += 1;
      if (keyLen === top) rec.longest[0] += 1;
    }
    if (lens.filter((l) => l === bottom).length === 1) {
      rec.shortest[1] += 1;
      if (keyLen === bottom) rec.shortest[0] += 1;
    }
    /*
     * "Guess between the two SHORTEST" had no check at all.
     *
     * Only the two extreme ranks were measured, so a habit one rank in passed
     * clean: a lane built a bank keying rank 0 in 8 of 36 and rank 1 in 14,
     * extremes at chance, and the audit exited 0 while "guess between the two
     * shortest" scored 61% against 40%. The bank-level check already had a
     * two-longest band and no mirror.
     */
    if (sorted[1] !== sorted[2]) {
      rec.bottom2[1] += 1;
      if (keyLen <= sorted[1]) rec.bottom2[0] += 1;
    }
  }
}

/*
 * Eight is the floor, not four as it is for the slot check.
 *
 * A slot check has five buckets and a lopsided split shows up early. A length
 * check has one bucket against a 20% expectation, where 3 of 8 is already 1.4
 * standard errors and means nothing. Below eight the answer is always "cannot
 * tell", and a check that fires on noise teaches the next reader to skim it.
 */
const TOPIC_LENGTH_MIN = 8;

const lengthBiased = [];
for (const [key, rec] of topicLengths) {
  const meanOptions = rec.options.reduce((a, b) => a + b, 0) / rec.options.length;
  for (const which of ["longest", "shortest", "bottom2"]) {
    const [hit, n] = rec[which];
    if (n < TOPIC_LENGTH_MIN) continue;
    const chance = (which === "bottom2" ? 200 : 100) / meanOptions;
    lengthBiased.push({ key, bank: rec.bank, which, hit, n, chance, share: pct(hit, n) });
  }
}

/*
 * Sorted by DISTANCE from chance, not by share.
 *
 * Sorting by share and taking the top five meant a floor breach could never
 * appear in the printed table, and a floor breach is the exact failure this
 * project records under "an instruction against a tell can create its mirror
 * image" — 0 of 53 is as exploitable as 20 of 53. It reached the failure list
 * either way, but the table a human actually reads showed five unrelated rows.
 */
const distance = (c) => Math.abs(c.share - c.chance);
lengthBiased.sort((a, b) => distance(b) - distance(a));

const WHICH_LABEL = { longest: "longest", shortest: "shortest", bottom2: "two shortest" };
console.log("\nMost length-biased topics (where the key sits by option length)");
for (const c of lengthBiased.slice(0, 6)) {
  console.log(
    `  ${c.key.padEnd(44)} ${WHICH_LABEL[c.which].padEnd(13)} ` +
      `${c.hit}/${c.n} (${fmt(c.share)}, chance ${fmt(c.chance)})`
  );
}

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

/* --------------------------------------- fixed option sets are FIXED ------ */

/*
 * A memorized option set must be identical on every question that uses it.
 *
 * Data Sufficiency and Quantitative Comparison are exempt from re-slotting
 * precisely BECAUSE their options are the same five (or four) strings in the
 * same order every time, which is what a real candidate learns to recognize
 * without reading. That exemption is only safe if the claim is true.
 *
 * It was not. A second authoring pass wrote the Data Sufficiency options with
 * different capitalization from the existing ones ("BOTH statements TOGETHER"
 * against "BOTH statements together"), giving one bank two variants of a set
 * whose whole point is that it never varies. The authoring agent noticed and
 * said so, which is the only reason it was caught before merge.
 */
for (const bank of banks) {
  for (const topic of SLOT_EXEMPT_TOPICS) {
    /*
     * PER BANK, not across all of them. NMAT and GMAT both have Data
     * Sufficiency and word the five statements slightly differently, which is
     * each exam's own business: a candidate memorizes the set for the exam they
     * are sitting. What must never happen is two variants inside ONE bank,
     * which is what a second authoring pass produced here.
     */
    const variants = new Map();
    for (const q of bank.questions) {
      if (q.topic !== topic) continue;
      const key = JSON.stringify(optionsOf(q));
      if (!variants.has(key)) variants.set(key, []);
      variants.get(key).push(q.id);
    }
    if (variants.size > 1) {
      const shapes = [...variants.values()].map((ids) => `${ids.length} starting ${ids[0]}`);
      failures.push(
        `${bank.name} / ${topic}: ${variants.size} different option sets (${shapes.join(", ")}) — ` +
          `this type's options are memorized and must be identical within a bank`
      );
    }
  }
}

/* ------------------------------------------ multi-select key positions ---- */

/*
 * WHERE THE KEYS SIT ON A MULTI-SELECT QUESTION, which nothing checked until
 * the GRE made a quarter of a bank multi-select.
 *
 * Every statistic above reads `correctIndex`, so a question with
 * `correctIndices` was invisible to all of them. That is not a small gap: GRE
 * Sentence Equivalence is 27 of 96 verbal questions, and it is the type where a
 * position habit pays best, because a blind guess is 1 in 15 rather than 1 in 5.
 *
 * The measured bias when this check was written: of 27 Sentence Equivalence
 * items, 23 had one key in the first three options and one in the last three,
 * 4 had both in the front, and ZERO had both in the back, against a chance
 * split of roughly 60/20/20. A candidate who simply never guessed a
 * both-in-the-back-half pair went from 6.7% to 11.1% without reading a word.
 * Separately the pair (2nd, 4th) alone was the key in 7 of 27, so guessing that
 * one pair every time scored 25.9%.
 *
 * Two checks, because they catch different things. The first is the direct
 * analogue of "always pick slot 1": how well does the best single fixed guess
 * do? The second catches a STRUCTURAL habit that no single pair reveals, which
 * is exactly what the front/back skew was.
 */
const multiByTopic = new Map();
for (const q of all) {
  if (kindOf(q) !== "multi") continue;
  if (!Array.isArray(q.correctIndices) || q.selectExactly == null) continue;
  const key = `${q.__bank} / ${q.topic}`;
  if (!multiByTopic.has(key)) multiByTopic.set(key, []);
  multiByTopic.get(key).push({
    n: optionsOf(q).length,
    idx: [...q.correctIndices].sort((a, b) => a - b),
  });
}

if (multiByTopic.size > 0) console.log("\nMulti-select key positions");
for (const [key, items] of multiByTopic) {
  const n = items[0].n;
  const k = items[0].idx.length;
  // Chance of guessing one fixed key set, and the three structural buckets.
  const combos = (() => {
    let c = 1;
    for (let i = 0; i < k; i += 1) c = (c * (n - i)) / (i + 1);
    return Math.round(c);
  })();

  const pairCounts = new Map();
  const buckets = { front: 0, back: 0, split: 0 };
  const half = Math.floor(n / 2);
  for (const it of items) {
    const sig = it.idx.join(",");
    pairCounts.set(sig, (pairCounts.get(sig) ?? 0) + 1);
    const inFront = it.idx.filter((i) => i < half).length;
    if (inFront === it.idx.length) buckets.front += 1;
    else if (inFront === 0) buckets.back += 1;
    else buckets.split += 1;
  }
  const [topSig, topCount] = [...pairCounts].sort((a, b) => b[1] - a[1])[0];
  const bestShare = pct(topCount, items.length);
  console.log(
    `  ${key.padEnd(40)} n=${items.length}  best fixed guess ${fmt(bestShare)} ` +
      `(chance ${fmt(pct(1, combos))}, set ${topSig})  front/back/split ` +
      `${buckets.front}/${buckets.back}/${buckets.split}`
  );

  // Under 10 questions any of this is noise.
  if (items.length < 10) continue;

  /*
   * The band is generous on purpose. This is a small sample and the point is to
   * catch a HABIT, not to demand a flat distribution: 20% against a 6.7%
   * chance is already three times better than reading the question.
   */
  if (bestShare > 20) {
    failures.push(
      `${key}: one key set (${topSig}) is the answer ${fmt(bestShare)} of the time ` +
        `(chance ${fmt(pct(1, combos))}) — guessable without reading`
    );
  }

  /*
   * A structural habit hides from the check above, because it is spread over
   * several key sets. Both halves must actually be used: an author who always
   * puts one key early and one late leaves "never guess two late" on the table.
   */
  for (const [name, count] of [
    ["both in the first half", buckets.front],
    ["both in the second half", buckets.back],
  ]) {
    if (pct(count, items.length) < 5) {
      failures.push(
        `${key}: ${count} of ${items.length} questions have ${name} — ` +
          `a candidate who never guesses that shape gains, so the positions are not really shuffled`
      );
    }
  }
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
  /*
   * NOT "analyses". It is the plural of "analysis" and is correct American
   * English, so flagging it fails perfectly good prose: "later analyses found
   * some heterogeneity". Only the verb forms are British, and "analyses" as a
   * British third-person verb is rare enough in this register that catching it
   * is not worth failing every plural noun.
   */
  [/\banalys(?:e|ed|ing)\b/i, "analyse: use analyze"],
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
    ...optionsOf(q).map((o, i) => [`option ${i}`, o]),
  ]) {
    for (const [re, name] of BRITISH) {
      const hit = text.match(re);
      if (hit) failures.push(`${q.id}: British spelling "${hit[0]}" in ${label} (${name})`);
    }
  }
}

/* ------------------------------------------------------------- the contract */

const WATCH = [];
const FAIL_Z = 3;
const WATCH_Z = 2;

const zOf = (hit, n, chance) => {
  const se = Math.sqrt(((chance / 100) * (1 - chance / 100)) / n) * 100;
  return se === 0 ? 0 : (pct(hit, n) - chance) / se;
};

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
  // singleN, not n: see the note on it above. Only single-choice questions
  // have a slot, so a file that also holds multi-select and numeric-entry
  // questions would otherwise be judged against a denominator it cannot reach.
  if (r.singleN === 0) continue;
  /*
   * The band is a multiple of chance, not a literal.
   *
   * It used to be [14, 36] at n >= 100 and [10, 42] below that, both written
   * against a four-option 25% chance rate. Two things then drifted out from
   * under it. The GMAT banks went from 30 questions to 90 and stayed in the
   * wide bucket, where a slot holding 42% of the keys is more than five
   * standard deviations from chance and still passes. And five of the eight
   * banks now offer five options, where those same literals mean 1.7x and 2.1x
   * chance rather than 1.44x and 1.68x.
   *
   * The n >= 100 cliff also had nothing behind it. 60 is where a bank is large
   * enough that a 1.45x deviation is not sampling noise.
   */
  const chance = 100 / r.optCount;
  r.slots.slice(0, r.optCount).forEach((c, i) => {
    const z = zOf(c, r.singleN, chance);
    const line =
      `${r.name}: slot ${i + 1} is the key ${fmt(pct(c, r.singleN))} of the time ` +
      `(${c}/${r.singleN}, chance ${fmt(chance)}, ${z > 0 ? "+" : ""}${z.toFixed(1)} SE)`;
    if (Math.abs(z) >= FAIL_Z) failures.push(line);
    else if (Math.abs(z) >= WATCH_Z) WATCH.push(line);
  });
}

/*
 * PER BANK, and with a FLOOR as well as a ceiling.
 *
 * Both halves of that were holes. The ceiling was asserted on the ALL row only,
 * so adding 192 GRE questions diluted it: bank-wide "longest is the key" fell
 * from 20.4% to 14.8% and a future regression in one NMAT file gained six points
 * of headroom under the same threshold.
 *
 * The floor matters more, and it exists because THIS PROJECT CAUSED THE PROBLEM
 * IT CATCHES. The GRE authors were told the key must not be the longest option,
 * and they complied absolutely: 0 of 53 prose questions, against 20% by chance
 * on a five-option set. "Never pick the longest" is then a free elimination on
 * every question, which is worth as much to a guesser as "always pick the
 * longest" would be. An instruction to avoid a tell produced its mirror image.
 *
 * The band is generous because the samples are small, and the point is to catch
 * a HABIT rather than to demand a flat distribution.
 */
/* The longest-option gate is one of the banded checks below. */

/*
 * A band around chance, applied per bank, for every heuristic that has one.
 *
 * These were four assertions on the ALL row, and the ALL row is the wrong place
 * for all of them. Measured while the GMAT bank tripled: the "largest" and
 * "smallest" caps kept roughly the same percentage but their spare headroom
 * grew from 31 hits to 44 and from 26 to 43, purely because the denominator
 * grew. Concretely, NMAT Logical Reasoning could go to 100% middle-keyed and
 * the ALL row would still land inside the cap.
 *
 * Each band is a multiple of that bank's own chance rate, so a five-option bank
 * is judged against 20% and a four-option bank against 25%.
 */
/*
 * Distance from chance, in standard errors.
 *
 * The threshold is 3, which on a two-sided test is about one false alarm in
 * 370 checks. A run makes roughly sixty of them, so a green build means green
 * and an author is not taught to shrug at this script.
 *
 * Anything past 2 is printed as a watch line without failing. That is the half
 * of this that matters in practice: the numbers the band forgives stay on
 * screen, so a bank drifting toward a real bias is visible one release before
 * it breaks the build, and nobody has to re-derive it from scratch. Both of
 * this project's genuine biases were found by someone measuring by hand.
 */

const band = (label, pick, chanceOf, minN, note, { ceilingOnly = false } = {}) => {
  for (const r of rows) {
    const [hit, n] = pick(r);
    if (n < minN) continue;
    const chance = chanceOf(r);
    const z = zOf(hit, n, chance);
    if (ceilingOnly && z < 0) continue;
    const how = z > 0 ? "too often" : `too rarely, ${note}`;
    const line =
      `${r.name}: ${label} scores ${fmt(pct(hit, n))} ` +
      `(${hit}/${n}, chance ${fmt(chance)}, ${z > 0 ? "+" : ""}${z.toFixed(1)} SE) — ${how}`;
    if (Math.abs(z) >= FAIL_Z) failures.push(line);
    else if (Math.abs(z) >= WATCH_Z) WATCH.push(line);
  }
};

const FREE_ELIMINATION =
  'so the rule inverts into a free elimination, which is worth as much to a guesser';

band('"guess between the two longest"', (r) => r.top2, (r) => 200 / r.optCount, 25, FREE_ELIMINATION);
band('"pick the longest"', (r) => r.longest, (r) => 100 / r.optCount, 25, FREE_ELIMINATION);
band(
  '"always pick the largest"',
  (r) => [r.extremes[1], r.extremes[2]],
  (r) => 100 / r.optCount,
  20,
  FREE_ELIMINATION
);
band(
  '"always pick the smallest"',
  (r) => [r.extremes[0], r.extremes[2]],
  (r) => 100 / r.optCount,
  20,
  FREE_ELIMINATION
);

/*
 * The middle-two rule keeps a ceiling and no floor, unlike the two above.
 *
 * Its floor would be "every key is at an extreme", which is not a bias a
 * candidate can act on without knowing WHICH extreme — and both extremes are
 * already banded separately just above. Its chance rate is the share of ranks
 * that are neither end.
 */
/*
 * Per topic, against that topic's own bank's chance rate.
 *
 * A topic belongs to one bank, so a four-option NMAT topic is judged against
 * 25% and a five-option GRE topic against 20%, the same way the per-bank checks
 * are.
 */
/*
 * MARGIN IS DELIBERATELY NOT MEASURED, and that is a real limit of this check.
 *
 * A key one character shorter than the runner-up counts exactly the same as one
 * twenty-four characters shorter, though only the second is a tell a candidate
 * can see. The six GRE Reading Comprehension items fixed in v2.8.2 had margins
 * of 6% to 37%; the eight left alone were between 1.5% and 5.8%, which is
 * invisible. That gap is a fact about that data, and this check cannot
 * reproduce the judgment.
 *
 * The consequence to know: a future author can clear a failure here by adding
 * one character to enough keys, and the audit will bless it. A minimum-margin
 * rule was considered and not adopted, because it adds a second threshold to
 * argue about and the count-based rule is what the slot and longest-option
 * checks already use. Read the margins before acting on a failure.
 */
for (const c of lengthBiased) {
  const z = zOf(c.hit, c.n, c.chance);
  const label =
    c.which === "bottom2" ? "in the two shortest" : `the ${c.which}`;
  const verb = c.which === "bottom2" ? "sits" : "is";
  const line =
    `${c.key}: the key ${verb} ${label} option${c.which === "bottom2" ? "s" : ""} ` +
    `${fmt(c.share)} of the time (${c.hit}/${c.n}, chance ${fmt(c.chance)}, ` +
    `${z > 0 ? "+" : ""}${z.toFixed(1)} SE)`;
  if (Math.abs(z) >= FAIL_Z) failures.push(line);
  else if (Math.abs(z) >= WATCH_Z) WATCH.push(line);
}

band(
  "the middle-two heuristic",
  (r) => r.mid,
  (r) => (100 * (r.optCount - 2)) / r.optCount,
  20,
  "",
  { ceilingOnly: true }
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

if (WATCH.length) {
  console.log("\nWatch list (past 2 standard errors from chance, not yet a failure)");
  for (const w of WATCH) console.log("  ~ " + w);
}

console.log("\n" + "=".repeat(72));
if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):\n`);
  for (const f of failures) console.error(`  x ${f}`);
  console.error("");
  process.exit(1);
}
console.log(`\nOK — ${all.length} questions across ${banks.length} banks.\n`);
