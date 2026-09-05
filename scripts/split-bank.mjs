/**
 * Split every question bank into what a candidate needs to ANSWER and what they
 * need to REVIEW. `npm run bank:split`, and it runs automatically before `dev`
 * and `build`.
 *
 * WHY. Opening a section downloads its whole bank, because the draw is made in
 * the browser — that is what keeps every page static and the hosting free. The
 * explanations ride along in the same file and are 20% to 47% of it depending
 * on the section, and NOT ONE of them can be seen until the candidate submits.
 * GMAT Quantitative was shipping 34.5 KB of prose to a person who had not yet
 * answered a question, over Philippine mobile data, in the seconds before a
 * timed section starts.
 *
 * WHAT IT DOES NOT DO. The files under `data/questions/` are untouched and stay
 * the source of truth: one file per section, explanation next to the question it
 * explains, which is the only sane thing to hand an author. `audit:bank` keeps
 * reading exactly what it reads today. The split is a build artifact.
 *
 * The output is generated rather than committed, so it cannot drift from the
 * source. It costs about a second and needs no network, so it does not weaken
 * the offline property.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "data/questions");
const OUT = join(root, "data/generated");

/** Every `.json` under data/questions, at any depth. */
async function banks(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await banks(full)));
    else if (entry.name.endsWith(".json") && !entry.name.startsWith("_")) found.push(full);
  }
  return found;
}

/** Mirrors `hasMath` in components/MathText.tsx: a `$...$` span. */
const MATH = /\$[^$]+\$/;

const files = (await banks(SRC)).sort();
if (files.length === 0) throw new Error("no question banks found");

let beforeTotal = 0;
let afterTotal = 0;
const rows = [];

for (const file of files) {
  const raw = await readFile(file, "utf8");
  const questions = JSON.parse(raw);
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error(`${file}: expected a non-empty array`);
  }

  const explanations = {};
  const stripped = questions.map((q) => {
    if (typeof q.id !== "string" || q.id === "") throw new Error(`${file}: a question has no id`);
    if (q.id in explanations) throw new Error(`${file}: duplicate id ${q.id}`);
    /*
     * An explanation is required in the SOURCE. Letting one be missing here
     * would ship a review screen with a blank where the reasoning goes, and the
     * failure would appear only after someone submitted a section.
     */
    if (typeof q.explanation !== "string" || q.explanation.trim() === "") {
      throw new Error(`${file}: ${q.id} has no explanation`);
    }
    explanations[q.id] = q.explanation;
    const { explanation, ...rest } = q;
    /*
     * KEEP ONE BIT OF THE EXPLANATION BEHIND: does it contain math?
     *
     * `questionNeedsMath` decides whether to preload the KaTeX chunk, and it
     * reads the explanation for a reason its own comment records: Logical
     * Reasoning has math in exactly ONE of 100 prompts but 28 explanations, so
     * the whole section's preload hung on a single question. Deferring the
     * explanations would have silently removed that signal and left the KaTeX
     * fetch to happen mid-review, which is the round trip the preload exists to
     * avoid.
     *
     * A boolean is 25 bytes against the 300 the prose costs, and only when
     * true, so the property is absent on most questions.
     */
    if (MATH.test(explanation)) rest.explanationHasMath = true;
    return rest;
  });

  const rel = relative(SRC, file).replace(/\\/g, "/");
  const base = rel.replace(/\.json$/, "");
  const questionsPath = join(OUT, `${base}.questions.json`);
  const explanationsPath = join(OUT, `${base}.explanations.json`);

  await mkdir(dirname(questionsPath), { recursive: true });
  // No indentation: this is a build artifact nobody reads, and the whitespace
  // is pure payload. The source files stay pretty-printed.
  const questionsJson = JSON.stringify(stripped);
  const explanationsJson = JSON.stringify(explanations);
  await writeFile(questionsPath, questionsJson);
  await writeFile(explanationsPath, explanationsJson);

  const before = Buffer.byteLength(raw);
  const after = Buffer.byteLength(questionsJson);
  beforeTotal += before;
  afterTotal += after;
  rows.push([base, before, after, Buffer.byteLength(explanationsJson)]);
}

const kb = (n) => (n / 1024).toFixed(1).padStart(7);
console.log("bank                          before   answer   review   saved");
for (const [name, before, after, review] of rows) {
  const saved = (100 * (before - after)) / before;
  console.log(
    `  ${name.padEnd(26)} ${kb(before)} ${kb(after)} ${kb(review)}   ${saved.toFixed(0).padStart(2)}%`
  );
}
console.log(
  `\n  ${"ALL".padEnd(26)} ${kb(beforeTotal)} ${kb(afterTotal)}` +
    `           ${(100 * (beforeTotal - afterTotal) / beforeTotal).toFixed(0)}% off the answering path`
);
