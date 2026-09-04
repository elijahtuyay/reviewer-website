# Project Context — NMAT Reviewer

**Read this file fully before doing anything.** It's a handoff document written for a brand-new Claude Code session with zero memory of prior work on this repo. Last updated: 2026-09-04, at PR #26 / VERSION.txt `2.8.0`.

## What this project is

An exam-prep web app for **NMAT by GMAC** (a Philippine business-school admission test), built with Next.js 16.3.0 (Turbopack), React 19, TypeScript, and Tailwind v4, with a Neon Postgres database behind Drizzle and better-auth as of v2.1.0 (backend only, no sign-in UI yet). A second exam, **GMAT Focus**, is fully playable on a 270-question bank (90 per section, 32 hard in each), which stopped being a seed bank in v2.8.0. A third, **GRE General**, arrived in v2.6.0 with 192 questions. See "THE MODULAR EXAM ARCHITECTURE" below. The repo lives at:

```
C:\Users\elija\Documents\Personal Files\AI_ML\Codes\reviewer-website
```

The user (Elijah) is a solo developer treating this like a real engineering team: strict git workflow, semantic versioning, mandatory autonomous code review before every merge. Read **`CLAUDE.md`** and **`AGENTS.md`** at the repo root now — they are checked-in, binding instructions, not optional context. The rules below summarize them but the files are the source of truth.

## Non-negotiable standing rules (from CLAUDE.md)

1. **Never commit directly to `main`.** Every change is a feature branch → PR → autonomous review → merge.
2. **One PR per coherent batch of work**, not one PR per tiny item. A single user request listing many small fixes is ONE PR with multiple internal modular commits, not many PRs.
3. **Semantic versioning in `VERSION.txt`** (plain text, repo root, NOT shown in app UI). Baseline is v1.0.0 at commit `6769f52`. Every commit on `main` since then is strictly > 1.0.0. Judge bump size yourself (patch/minor/major).
4. **Never give the version bump its own commit.** Fold it into the last substantive commit of the PR, or `git commit --amend` it in before pushing (this is one of the few cases amending/force-pushing your own unshared feature branch is pre-authorized).
5. **Autonomous review is mandatory and automatic** — dispatch review subagents (Agent tool, `general-purpose` type, senior/lead-engineer framing) before every merge without asking permission first. They should check for bugs AND design fidelity to intent, not just local correctness. Apply their fixes before merging.
6. **Merge commit must visibly show the version** (e.g. squash-merge title `"... (v1.4.0)"`) so version history is legible at a glance in `git log`.

## Language: American English, everywhere

**All written output uses American English**, user-facing copy and code comments alike: UI strings, question prompts, options, explanations, commit messages, and these docs. The audience sits NMAT and GMAT, both written in American English, and a British spelling in a Language Skills stem is a distraction at best.

Watch the usual families: `-ise`/`-isation` to `-ize`/`-ization`, `-our` to `-or`, `-re` to `-er`, doubled `l` before a suffix (`labelled` to `labeled`), `practise` (verb) to `practice`, `program` to `program`, `whilst` to `while`. Metric units in question text too: `kilometres` to `kilometers`, `litres` to `liters`.

**Three traps, all hit during the v2.0.2 sweep.**

**Never run the sweep over raw JSON text.** Operate on the PARSED values. A literal `\\n` inside a JSON string glues the escape's `n` to the next word, so `"...by programme:\\nProgramme P:"` has no word boundary before the second `Programme` and `programme` silently skips it. That left one question reading "acceptances by program" above a table labeled "Programme P", which is exactly the mixed usage the sweep exists to remove. Parsing the file first makes the whole bug class impossible.

**Prefer stems to word lists for the `-our` family.** An enumerated list missed `labour` entirely and matched `neighbour` but not `neighbourhoods`. A stem pattern (`lab|col|fav|neighb|behavi|...` + `our` + any suffix) covers every inflection at once, and the words that genuinely end `-our` in American English (four, hour, tour, pour, flour, contour, devour) are simply absent from the stem list.

**Keep an `-ise` exception list.** A blanket `-ise` to `-ize` rule breaks words that are legitimately `-ise` in American English: it turned `advertise` into `advertize` and, worse, `counterclockwise` into `counterclockwize` inside the circular-seating puzzles. Keep an exception list (advise, comprise, compromise, exercise, improvise, revise, supervise, surprise, promise, and every `-wise` compound). And never rewrite an identifier: `cancelLabel` is a prop, `color` is a CSS property, and `Content-Security-Policy` is a header name. Word-boundary patterns plus a grep for identifiers afterwards is the check that caught this.

## Language: Simplified Technical English (ASD-STE100) for all UI copy

**Every user-facing description on this site is written to ASD-STE100**, the
controlled-English standard from ASD (the AeroSpace and Defense Industries
Association of Europe): 53 writing rules plus a ~900-word approved dictionary,
built so a non-native reader working from a manual cannot misread an
instruction. It was adopted here at the user's direction in v2.4.0, because the
previous copy read as machine-written marketing. Run `npm run audit:copy`
rather than trusting this paragraph.

Why it fits rather than merely being a constraint: most NMAT and GMAT
candidates in the Philippines are non-native English readers, and the copy they
are reading explains a timed exam they are about to start. The rules that
protect an airline mechanic from a misread torque spec protect a candidate from
a misread section rule.

The rules that bind here, in the order they actually get broken:

1. **Simple tenses only.** Infinitive, imperative, simple present, simple past,
   simple future, and a past participle used only as an adjective. No perfect
   ("you have used them all") and no progressive ("its timer is running").
   `unanswered` is fine, because it is a participle acting as an adjective.
2. **No semicolon at all** (Rule 8.1). Not "not as a clause join" -- the mark is
   banned outright. Every other mark, the em dash included, is permitted, though
   this repo already avoids em dashes in user-facing text for its own reasons.
3. **25 words per sentence** for descriptive text, 20 for an instruction. One
   instruction per sentence. Do NOT hit the limit by dropping a subject, a verb
   or an article -- the standard warns that ellipsis buys ambiguity, not clarity.
4. **No phrasal verbs** (Rule 9.3). "pick up where you left off", "carry over",
   "run out of time", "free this up" all went. Their meaning is not predictable
   from the parts.
5. **One word, one meaning.** The settled choices in this app: **timer**
   (never "clock"), **select** (never "pick" or "choose"), **incorrect** (never
   "wrong"), **no answer** for a question left blank (never "skipped" or
   "unanswered" as a label), **restart** (never "start over"), **section**,
   **question**, **answer**, **explanation**, **submit**, **score**. Reusing one
   word for one concept is the rule, so a new synonym is a regression even when
   it reads better in isolation.

   Two verbs were separated because they had drifted into carrying several
   senses each. **"follows"** is now only *conforms to* ("each exam follows its
   own published format"); difficulty **changes with** your answers and the
   rules **depend on** the exam. **"continues"** is now only the timer.
6. **Verb, not the noun made from it** (Rule 3.7). "This section tests
   arithmetic", not "the section provides testing of arithmetic".

**`npm run audit:copy` enforces 1 through 5 mechanically** and exits non-zero on
a finding. It walks `app/` and `components/` plus the three `lib/` files that
carry copy, rather than reading a hand-kept list: the list version shipped
already missing `components/Timer.tsx`, which emits screen-reader strings. It
does NOT check membership in ASD's approved dictionary, because that list is not
redistributable and the official Issue 9 PDF is encrypted, so any word list
committed here would be guesswork with a checkmark next to it. Rule 6 and
dictionary compliance stay a judgment call for the author and the review lanes.

**THE FIRST VERSION OF THIS SCRIPT PASSED WHILE READING ALMOST NOTHING, and that
is the part to remember.** It reported "no findings" over `SectionNav`'s
`{n} wrong` and `{n} skipped`, which broke two settled terms at once, because
two separate blind spots lined up:

- Its JSX pass matched text between a `>` and a `<`, then discarded any string
  containing `{`. Every paragraph interrupted by an interpolation was exempt.
- Its literal pass paired quotes in scan order, so one mis-paired match (a
  CLOSING quote joined to the next OPENING quote) swallowed everything between
  them. That ate both runners' entire `ConfirmDialog` block.

Three defenses now exist, and all three are load-bearing. Interpolations are
collapsed to "N" **inside a captured run**, never across the file (collapse
globally to a fixpoint and the outermost pair eaten is the component function's
own body, which deletes every JSX node in the file — measured: 143 strings down
to 99). String literals require a plausible delimiter before the opening quote
and after the closing one, so a mis-pairing is unmatchable. And a file that
yields zero strings while not on `NO_PROSE_EXPECTED` is a **failure**, not a
quiet pass. The run prints how many strings it inspected, so a coverage collapse
shows up as a number that moved: it reads **274** today, against 143 for the
version that was effectively blind.

The word floor is **two** words, not three. Three looks safer and is not:
`{n} wrong` collapses to two words, and that was the only real vocabulary breach
in the app. Two other filters are worth keeping as they are. Strings with
punctuation that has no space after it are dropped, because
`useRef<HTMLElement | null>(null); const` is indistinguishable from a JSX text
node between a `>` and a `<`, and that alone produced ten of the script's first
thirteen findings. HTML entities are decoded first, or `Section &amp; progress`
reads as a Rule 8.1 breach. A script with false positives teaches the next
reader to skim it.

**The question bank is deliberately out of scope.** A Language Skills question
about the present perfect has to be able to contain the present perfect, and
exam prose should read like exam prose. STE governs what the SITE says, not what
the questions say. American English still governs both -- see the section above,
which this one does not replace.

One consequence is visible on screen and was considered rather than missed: a
GMAT stem can read "Choose the correct preposition" three lines under the app's
own "Select an answer to continue". Real exam stems say "choose", changing them
would make the practice less faithful, and faithfulness beats internal
consistency here. Do not re-report it.

## THE GRE, AND THE QUESTION KINDS IT REQUIRED (v2.6.0)

The third exam, and the first one that could not be expressed with the engine as
it stood. NMAT and GMAT are both "pick one of four or five"; the GRE is not, and
the two types it adds are whole question types rather than variants.

### An answer is no longer an option index

`Question.kind` is `"single" | "multi" | "numeric"`, and **it is OPTIONAL, with
absent meaning "single"**. That is why all 390 pre-existing questions and every
attempt already sitting in a user's sessionStorage needed no migration.

| kind | fields | why it exists |
| --- | --- | --- |
| `single` | `options`, `correctIndex` | everything NMAT and GMAT ask |
| `multi` | `options`, `correctIndices`, `selectExactly` | **Sentence Equivalence**: six options, exactly two right, and both are required. Roughly a sixth of GRE Verbal. |
| `numeric` | `correctValue`, `tolerance`, `answerPrefix/Suffix` | **Numeric Entry**: no options at all, you type the number. |

**`lib/answers.ts` is the only place that knows how each kind is stored, marked
and compared, and every comparison must go through it.** The trap it exists to
close is that `answers[id] !== original` is correct for a number and silently
WRONG for an array, because two arrays with the same contents are never
`!==`-equal. The review allowance and the adaptive ladder both used that test.
A null check has the mirror-image problem: an empty numeric string and an empty
selection array are both truthy, so a section reads as fully answered before the
candidate types anything.

Numeric marking is deliberately lenient. Commas, currency signs and simple
fractions parse, and questions carry a `tolerance`. Being marked wrong over a
comma teaches nothing about mathematics.

### THE BUG A BROWSER FOUND AND NOTHING ELSE COULD

QuestionCard used to receive the current answer as a PROP and compute the new
array itself. Two clicks inside one frame both read the same prop, because React
has not re-rendered between them, so the second click derived its array from the
pre-click answer and **overwrote the first**. Measured in headless Chrome:
clicking two options of a Sentence Equivalence in one tick left exactly ONE
selected, on the question type whose entire rule is that you select two.

The card now sends the INTENT (`onToggle`) and `toggleOption` derives the answer
inside the state updater, where `prev` is the freshest answers by definition.
This is the third time this repo has had to move a computation into the updater
for exactly this reason (see also `select` and the review allowance). **If you
find yourself deriving new state from a prop in a click handler here, that is
the bug.**

Two harness bugs produced convincing false failures on the way, and both are
worth knowing before writing another browser check: reading `aria-checked` in
the same synchronous block as `.click()` reads the DOM before React commits, and
dispatching the period key with `windowsVirtualKeyCode: 46` sends VK_DELETE, so
"12.5" arrived as "125" and looked exactly like input filtering that does not
exist. Use `Input.dispatchKeyEvent` with `type: "char"`.

### The exam itself

Structure is ETS's published structure for the shortened test that began
22 September 2023. Three things are easy to get wrong from older material,
because the 2023 revision changed all of them: there is **one** essay now rather
than two, the sections are much shorter, and **geometry IS on the GRE**, which is
the opposite of GMAT Focus and the easiest way to write a wrong bank.

**Modeled as TWO sections where the real exam has four.** Each measure keeps its
real totals (Verbal 27 questions / 41 minutes, Quantitative 27 / 47), but the
real split into two separately timed sub-sections is not reproduced. Splitting
the bank four ways would leave each section a pool barely larger than one
sitting, which is the problem the GMAT seed bank demonstrated before v2.8.0
tripled it.

**The GRE is far closer to a paper exam than the GMAT**, which is the part people
assume wrongly because both are computer-delivered. Inside a section you move
freely, skip, and change any answer until time ends, so `navigation` is `"free"`
and `reviewEdit` is null. Its adaptivity is BETWEEN sections, not between
questions, which is why `adaptive` is null on an adaptive test.

**`scoreStep` is now declared by the exam.** GMAT Focus is 205-805 in tens; the
GRE is 130-170 in ones. Inheriting the old hard-coded ten would have left a
candidate five reachable scores across an entire measure.

### `CalculatorKind` has three values now, not two

`null` already meant something load-bearing: "the real exam gives you none
either", which the setup page states as a rule. The GRE grants one in
Quantitative Reasoning, so `null` there would print a flat lie on the page a
candidate reads immediately before starting. Hence **`"not-simulated"`**.

It is emphatically NOT `"basic-di"`. That models a TI-108: strictly left to
right, so `2 + 3 x 4` is 20. **The GRE's calculator honors order of operations
and gives 14**, has parentheses, has a Transfer Display key that types the result
into a Numeric Entry box, and takes keyboard input. This repo has already shipped
a calculator that borrowed three details from the wrong device. A subtly wrong
calculator is worse than an absent one, because the candidate practices habits
that break on test day.

### `ExamModule.notes`, and the gap it closes

The setup page's "what to expect" list is generated from `rules` so the copy
cannot claim behavior the engine lacks. That design had one hole: a fact that is
true of the real exam and deliberately NOT implemented has no rule to generate
from, so it goes silently unsaid. `notes` is appended verbatim to the generated
list, and the GRE uses it for the missing 30-minute essay and the missing
section-level adaptivity.

**Use it only for differences between the real exam and this app.** Anything the
engine does belongs in `rules`, where it cannot drift. An escape hatch used for
ordinary copy becomes the hand-written blurb the generated list replaced.

### Audit changes, which are the audit LEARNING the new kinds

- Multi and numeric questions are excluded from the slot, longest-option and
  middle-two samples, where those statistics are undefined rather than unusual.
  Counting `undefined` as slot 0 would report a bias that does not exist.
- **The slot denominator is the count of questions that HAVE a slot.** GRE Verbal
  is single-choice for only part of its file, so measuring five slots against the
  file total made an even spread look under-used and would have failed a bank
  with no bias at all. Files where the two differ print `n=NN*`.
- **Quantitative Comparison joins Data Sufficiency as a fixed-option topic**,
  exempt from slot re-balancing AND from the longest-option heuristic. Its four
  options are memorized and identical on every question, so "the relationship
  cannot be determined from the information given" is always the longest string
  and being the answer proves nothing about guessability.
- "every option is keyed" applies only to FIXED-COUNT multi-select. On the GRE's
  open select-all, all three statements being true is a real case, and forbidding
  it would itself be exploitable knowledge.

### The scaled denominator depends on whether the exam is ADAPTIVE

`ScoringModel` declares `denominator: "fixed-reference" | "served"`, and getting
this wrong is silent.

- **"fixed-reference"** measures the earned weight against a full section of the
  hardest available material. Correct for an adaptive exam (GMAT Focus), because
  there the candidate climbs to the hard questions by answering well, so
  reaching them IS the achievement and the top of the band should demand it.
- **"served"** measures against the weight of what was actually drawn. Correct
  for a non-adaptive exam (GRE), where the mix is random and the candidate has
  no influence over it.

**The GRE shipped briefly with the fixed reference and could not reach its own
band.** A 27-question draw averages about 2.28 weight per question against a 3.2
ceiling, so a FLAWLESS attempt scored about 159 of 170, and two flawless
attempts differed by up to 11 points purely on draw luck, while the setup page
generated "the score runs from 130 to 170" as a statement of fact.

**The assertion that was missing is the whole lesson.** `verify:engine` checked
that the GRE score stayed BELOW its maximum. It did, by eleven points, on a
perfect run. A ceiling test cannot see a floor problem. It now asserts that a
flawless run REACHES the maximum whatever the draw held, and that difficulty
still separates partial runs (hard half 160, easy half 140) so "served" did not
quietly turn `difficultyWeight` into decoration.

### An instruction against a tell can create its mirror image

The GRE authors were told the correct answer must never be the longest option.
They complied absolutely: **0 of 53** prose questions, against 20% by chance on
a five-option set. "Never pick the longest" then became a free elimination on
every question, worth exactly as much to a guesser as "always pick the longest"
would have been.

The audit could not see it, because the longest-option check had a ceiling
(33%) and no floor, and was asserted on the ALL row only, so 192 new questions
also diluted the bank-wide number from 20.4% to 14.8% and handed a future NMAT
regression six points of fresh headroom. It is now **per bank, with a floor of
8% and a ceiling of 33%.**

Write the instruction as "aim for chance", never as "never do X".

### Multi-select key positions were entirely unaudited

Every statistic in `audit:bank` read `correctIndex`, so a question with
`correctIndices` was invisible to all of them. That was 50 of the 192 new GRE
questions, including Sentence Equivalence, which is the type where a position
habit pays best: a blind guess is 1 in 15 rather than 1 in 5.

Measured before the check existed: of 27 Sentence Equivalence items, 23 had one
key in the front three options and one in the back three, 4 had both in front,
and **zero** had both in the back, against a chance split near 60/20/20. The
pair (2nd, 4th) alone was the key 7 times, so guessing that one pair every time
scored 25.9% against a 6.7% chance. Separately the two keys were **never
adjacent and never five apart**, so a third of the pair space was dead.

Two checks now cover it, because they catch different things. The first asks how
well the best single fixed guess does, which is the direct analogue of "always
pick slot 1". The second requires both halves to actually be used, which catches
a STRUCTURAL habit that no single key set reveals. The fix to the data was a
permutation of the options array cycling through all 15 possible pairs, with the
`id -> keyed values` snapshot proving no answer moved.

**The open "select all that apply" variant is deliberately not covered** by these
checks, because its `selectExactly` is null and its main defense is that the
NUMBER of correct statements varies. If that type grows, check the count
distribution rather than the positions.

### THERE ARE TWO CALCULATORS NOW, AND THEY MUST NOT BE MERGED

`lib/calculator/basic-di.ts` is the GMAT Focus TI-108. `lib/calculator/gre-standard.ts`
is the device ETS provides in GRE Quantitative Reasoning. They are different
machines and the differences change answers:

| | GMAT (`basic-di`) | GRE (`gre-standard`) |
| --- | --- | --- |
| `2 + 3 x 4` | **20**, strictly left to right | **14**, order of operations |
| parentheses | none | yes |
| percent key | yes, and contextual | none |
| clear | one `ON/C` for entry and calculation | `C` clears the calculation, `MC` clears memory |

`verify:engine` asserts both, and asserts that same key sequence against BOTH
devices side by side, specifically so that a later "simplification" into one
shared calculator fails the build. Merging them would teach the wrong arithmetic
for whichever exam the candidate is not taking.

**`CalculatorPanel` is a shell driven by a model** (`calculator-models.tsx`).
Everything that took real work to get right lives in the shell and is shared:
the sticky/absolute positioning, the MEASURED `--calc-max-h`, the
width-and-breakpoint coupling, click-outside, Escape, and the memory indicator
on the closed toggle. Only the keypad rows, the one-line banner and the
disclosure detail differ per device. **Do not duplicate the shell to add a third
calculator** — that component's own header records three separate layout bugs,
each found once, and a copy would need each fixed twice.

One bug the assertions caught while the GRE reducer was being written: `C`
returned the initial state wholesale and wiped memory. Memory surviving a clear
is exactly what makes it useful on a device whose only escape from precedence is
banking a subtotal.

### A MODEL FIELD THAT NOTHING READS IS INVISIBLE TO EVERY TOOL

`CalculatorPanel` shipped with `model.banner`, `model.details`, `model.label`,
`KeySpec.span` and `KeySpec.primary` all declared, all supplied correctly per
device, and **none of them read**. The GRE panel therefore explained itself with
the TI-108's copy: "it calculates left to right, so 2 + 3 x 4 is 20", directly
contradicting its own reducer, which returns 14 and is asserted doing so two
files away. Its explainer named three keys its keypad does not have.

`tsc`, `lint`, 30 calculator assertions and a browser run that exercised the
arithmetic all passed. An unread object field is not a type error, not a lint
error, and not visible to a test that only presses keys.

**When you split one component into a shell plus per-instance data, assert on
the RENDERED difference, not just the behavior.** `banner.mjs` in the scratchpad
does this: it opens each panel and requires the GRE's to say 14 and the GMAT's
to say 20. Two review lanes found this independently, which is the only reason
it did not ship.

### The `entryMode` trap is not specific to one calculator

`gre-standard.ts` reproduced, verbatim, the bug PROJECT_CONTEXT already records
against `basic-di.ts`: treating "nothing is being typed" as "no operand was
supplied". A square root, a memory recall, a sign flip and a closed parenthesis
all produce a value while `entry` is null, so `2 + 9 √ × 4 =` returned 8 —
the root's 3 discarded and the `+` overwritten by the `×`.

Both calculators now carry an explicit flag for "the display holds an operand
not yet committed" (`operandReady`), and both carry assertions for it. **Any
future calculator needs the same flag and the same assertions**, because the
temptation to fold the two conditions together is apparently irresistible.

A related one worth stating: a well-formed-expression fuzzer cannot see this
class. The review lane ran 300,000 random expressions with zero mismatches while
all four blockers were live, because a fuzzer generates valid input and this bug
lives in the sequences a human types by accident.

### Known gaps, recorded rather than papered over

- No Analytical Writing. An essay cannot be auto-scored, and a writing box that
  awards a number nobody stands behind is worse than an honest absence.
- No section-level adaptivity, and each measure is one section rather than two.
- **Text Completion is single-blank only.** The real exam has one-, two- and
  three-blank variants, where each blank has its own three options. Rendering
  that needs a per-blank control the card does not have. One-blank items with
  five options are entirely real, so what ships is faithful as far as it goes.
- Transfer Display is modeled in the reducer (`displayValue`) but is not wired
  to the Numeric Entry box, so the value is read and retyped rather than
  transferred. The cost is a habit rather than an answer.
- The GRE keypad is seven rows, because 25 keys do not divide into four
  columns. At scroll position zero its last row sits about 25px below the
  fold and needs the panel's own internal scroll. Any page scroll engages
  the sticky wrapper and the whole pad is visible.
- No keyboard entry on either calculator, deliberately. See the long note in
  `basic-di.ts`.

### Quantitative Comparison has its own layout

All 32 QC questions store optional common information, then a line each for
"Quantity A:" and "Quantity B:". `QuestionCard` splits that shape and renders
two labeled, equal-width boxes, guarded exactly as `splitPassage` is: both
labels present, on their own lines, B last, neither quantity spanning lines.
Anything else falls through to plain rendering rather than showing a mangled
card.

Equal widths are deliberate. The question is which quantity is larger, and a
wider box would answer it for the candidate.

## Copyright rule (critical, applies to ALL future content work)

Three reference books live at **`internal docs/nmat test files/`, inside the repo working tree** (with markdown conversions in its `md/` subfolder, plus the user's own GMAT notes as .txt files, and a generated answer-key PDF one level up). An earlier version of this document placed them at `C:\Users\elija\Downloads\nmat test files\`; they moved, and nobody updated the path or added an ignore rule.

**`internal docs/` is gitignored as of v2.3.0, and `.githooks/pre-commit` hard-fails any commit that stages a path under it.** Both are necessary. The repo is PUBLIC, the directory was untracked but NOT ignored, and CLAUDE.md forbids blanket staging only *while an agent is running* — so any session with no agent running was explicitly permitted to `git add -A` and publish three copyrighted books to GitHub. An ignore rule alone is advisory (`git add -f` walks straight past it), which is why there is also a hook. Enable it after a fresh clone with `git config core.hooksPath .githooks`; git does not set it for you. Verified nothing was ever committed:

```bash
git log --all --diff-filter=A --name-only --pretty=format: | grep -i "internal docs"   # empty
```

The books:
- NMAT Official Guide 2021
- Princeton Review GMAT Premium Prep
- GMAT for Dummies

These are **pirated/copyrighted** and may be used **strictly as calibration reference** — topic taxonomy, style, question difficulty, real-world proportions of question types. **NEVER copy or paraphrase their actual text, numbers, scenarios, or passages.** All question content in this repo must be original composition. The user's exact words: *"you may use them as reference, but style your questions to be as absolutely, humanly close and faithful to them as legally possible. those files are the holy grail of our accuracy."* Treat their reported facts/answers as ground truth to calibrate against, but never reproduce their prose.

## AGENTS.md warning — read before touching Next.js APIs

This Next.js version (16.3.0) has **breaking changes vs. typical training data**. Before writing any routing/data-fetching/API code, check `node_modules/next/dist/docs/` (resolved relative to repo root) for this version's actual conventions. This has mattered in practice — e.g. `notFound()` is documented as callable only from Server Components/Server Functions/Route Handlers, NOT Client Components (see "Known issue" below for how this was handled).

## Architecture

### Shared plumbing (see "THE MODULAR EXAM ARCHITECTURE" below for how exams are registered)

This subsection used to describe a `lib/exam-config.ts` and a `lib/data/questions.ts`.
**Both were deleted in v2.0.0 and neither exists.** The registry is
`lib/exams/registry.ts` and the bank loader is `lib/question-bank.ts`. The note is
left here rather than silently removed because those two filenames survived in this
document for two releases and sent readers looking for files that were gone.

- `data/schema.ts`: `ExamId = "nmat" | "gmat"`. `SectionId` is a loose `string` (not a fixed union) since each exam has different sections.
- **Accent colors.** NMAT green `#0f7b4d` is an *approximated* brand color (mba.com/exams/nmat was bot-protected during scraping attempts, so it is not pixel-verified — swap it if you ever get the exact hex). GMAT blue is `#2563eb`, chosen by measuring contrast rather than taste; see the accent trap below.
- Routes: `app/[examId]/page.tsx` (exam setup/landing), `app/[examId]/quiz/[section]/page.tsx` (a shell that picks a runner, client component). `app/[examId]/layout.tsx` (server) validates `examId` and applies the exam's theme via CSS custom properties on a `display: contents` wrapper (zero layout impact, properties still inherit). `app/[examId]/quiz/[section]/layout.tsx` (server) validates `examId` + `section` + availability before the client page renders.
- **Question bank file layout, and a warning attached to it.** NMAT's three JSON files sit at the flat path `data/questions/{language-skills,quantitative-skills,logical-reasoning}.json`, NOT in a `data/questions/nmat/` subfolder. That is deliberate: an attempted `git mv` into a subfolder was caught and reverted while background content-fix agents were actively editing those exact files at the old path. GMAT's three files DO live in `data/questions/gmat/` (`data-insights.json`, `quantitative.json`, `verbal.json`), they are tracked, and they hold the entire GMAT bank. **An earlier version of this document described that directory as "an empty, untracked leftover, safe to ignore or delete." Do not do that; it would delete the GMAT question bank.**
- `lib/session-progress.ts` (was `lib/local-progress.ts` until v1.6.0): **sessionStorage**, keyed `progress:${examId}:${section}`. Every read/write path is wrapped in try/catch. The record holds `answers`, `submitted`, `questionIds`, `deadline` (epoch ms), `expired`, `pausedAt`, and `summary`. sessionStorage is deliberate: an attempt survives reloads and moving between the setup page and a quiz, but dies with the tab/browser. `purgeLegacyPersistedProgress()` clears the old, permanently-lingering localStorage `progress:*` keys from pre-1.6.0 builds. Also exports `clearSectionProgress` / `clearExamProgress` for explicit restarts.
- `lib/scoring.ts`: both scoring models. See "Scoring traps" below before touching it.
- `lib/section-result.ts`: `getSectionBreakdown(examId, sectionId, fallbackTotal)` powers the post-submit correct/wrong/skipped breakdown, and `findActiveAttempt()` is the real section-lock check. **It does not read the question bank** — the score is written into sessionStorage as `StoredProgress.summary` at submit time, which is what keeps the bank off the critical path.

### Question bank content
- **300 questions total**, 100 per section (`language-skills`, `quantitative-skills`, `logical-reasoning`), stored in `data/questions/*.json`.
- **36 questions are drawn randomly per attempt** from each 100-question pool via Fisher-Yates shuffle (`drawRandomQuestionIds`), *"to truly test them"* per the user's explicit design intent — not the same 36 every time.
- Difficulty distribution, verified on disk, identical across all 3 files: **15 easy / 45 medium / 40 hard**.
- Topic ratios were rebalanced against real NMAT Official Guide chapter proportions (counted by hand from the reference book's actual practice chapters, e.g. logical-reasoning: Critical Reasoning 19% / Deductions 16% / Analytical Puzzles 36% / Other 29%, matching the real book's ~18.6/16.3/35.7/29.3 split).
- Zero em dashes (—) in any user-facing `prompt`/`explanation`/option text (repo-wide "AI slop" removal was explicit user direction).
- Currency: **use the peso sign (₱), not `$`**, in question text. This is not a style preference — literal `$` collides with the app's KaTeX math-delimiter parser (see Known Issues #3 below). 24 quantitative-skills questions were already fixed; if you add new money-related questions, use `₱` from the start.
- Math notation: inline LaTeX delimited by single `$...$` (e.g. `"If $x^2 = 9$, what is $x$?"`), rendered by `components/MathText.tsx` via `react-katex`. Literal `\n` in prompt/explanation text becomes a real line break (used for table/list-style questions). As of v1.7.0 the whole bank is normalized: **all** math notation is LaTeX (531 spans), every fraction is `\frac`, and no Unicode minus (U+2212) appears inside math. **Do not add custom `.katex` CSS** — KaTeX positions fractions with inline styles it computes itself and `katex.css` already pins `line-height` and `font-size`, so stylesheet overrides are no-ops or harmful (a v1.7.0 attempt silently shrank all math by 11%). `MathText` prefixes spans **containing a fraction** with `\displaystyle` so they typeset at full size instead of script size; that is the supported place to change math rendering. It deliberately does NOT apply to every span (as it did until v2.0.0), because display style also swells superscripts and made `$x^2$` ride up into the line above.
- Schema per question (see `data/schema.ts` `Question` type): `id`, `section`, `topic`, `difficulty` (`"easy"|"medium"|"hard"`), `prompt`, `options: string[]`, `correctIndex`, `explanation`, `source` (e.g. `"original"`).

### UI/UX conventions currently in place
- Apple-style page transitions: `components/PageTransition.tsx`, a pathname-keyed CSS fade-remount (NOT React's experimental `<ViewTransition>` — deliberately avoided as too fragile for this Next.js version). Respects `prefers-reduced-motion`.
- Sticky "freeze-pane" quiz header (`h-20`) + sticky sidebar (`top-24` — the math is `80px header + 16px gap = 96px = top-24`, don't break this alignment if you resize the header).
- Full-screen anti-cheat pause overlay (`components/PauseOverlay.tsx`): blurred backdrop, freezes the `Timer`, and the underlying quiz content is marked `inert` (React 19 native attribute) while paused — this removes it from both pointer interaction AND keyboard tab order, not just visual pointer-events blocking.
- Mobile nav: below the `lg` Tailwind breakpoint, the desktop sidebar (`SectionNav` + `ProgressTracker`) is hidden. `components/MobileNavSheet.tsx` is the mobile fallback — a bottom sheet triggered by a "Sections" header button, with Escape-to-close, body scroll-lock, and the background marked `inert` while open (mirrors the pause-overlay pattern).
- Focus-visible ring: global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` in `app/globals.css` — added specifically because all three researched government design systems (see below) treat visible focus as non-negotiable.
- Answer correctness in review mode is shown by **both color AND a text label** ("Correct answer" / "Your answer") — never color alone (WCAG requirement, was a real bug, fixed in PR #6).
- **Design tokens and motion (v2.3.0).** `app/globals.css` is the single source for both. Three things there are load-bearing and easy to undo by accident:
  - **`--focus-ring` is NOT `--accent`.** `outline-offset: 2px` draws the ring on the element's PARENT surface, so it must clear 3:1 against every surface a control can sit on. Raw `--accent` measured 2.60:1 on the dark panel and 2.25:1 on `--panel-hover`, and **1.00:1 on the home page's accent hero band — no focus indicator at all on the site's two primary CTAs.** `--focus-ring` derives from `--accent-text`, which clears 3:1 everywhere for both exams. Accent-filled surfaces carry `.on-accent`, which flips the ring to `--accent-foreground`. **Like `--accent-text`, it must be re-declared on `.exam-theme`** — a custom property containing `var()` resolves at the element that DECLARES it, so a `:root`-only declaration would leave every GMAT page focus-ringing in NMAT green.
  - **Motion tokens are `--ease-standard` / `--ease-enter` / `--ease-exit` / `--ease-page`,** exposed as Tailwind utilities through the `--ease-*` namespace, and Tailwind's own default transition curve is retuned at the root. The values are Material 3's, which is the only design system this project follows that publishes motion at all — USWDS, Canada.ca and SGDS ship color/type/spacing and stop. **Apple publishes principles and no numbers, so do not attribute a duration or a bezier to it.** Rules: animate `transform`/`opacity`/`filter` only, never `width` or any layout property; enter with `--ease-enter` and leave faster with `--ease-exit`; stay under 300ms unless the distance traveled is large.
  - **Press feedback is `scale`, never `opacity`.** Fading an accent fill toward the page erodes the text contrast the tokens exist to guarantee. Before v2.3.0 there were ZERO `:active` states in the app — fifty hover affordances and no press feedback, on a product whose audience is mostly touch, where `:hover` does not exist at all.
  - `.btn` / `.btn-primary` / `.btn-secondary` exist because the primary button was written out byte-for-byte in **seven** files and the secondary in six, which is exactly why their motion had drifted apart. Add a button variant there, not at a call site.
  - `prefers-reduced-motion` is a global net that collapses durations rather than four hand-placed classes (which meant anything added later was unguarded by default). It cannot reach JS-driven motion, so `lib/motion.ts` supplies `scrollBehavior()` for `scrollIntoView`.
- **Typography is a system as of v2.9.0, and the complaint that produced it is
  worth keeping.** The user said the type felt "too repetitive and bland, very
  amateurish". It was: every heading, label and paragraph on the site was Geist,
  separated only by a Tailwind size class. Size alone is a weak signal, because
  it says how important a thing is and nothing about what KIND of thing it is,
  so a page of headings, labels and prose in one face reads as undifferentiated
  however the sizes are arranged.

  Four changes, and only one of them touches a component:

  - **Headings take a display serif** (`Source Serif 4`, `--font-display`).
    Tailwind sets size and weight on heading elements but never a family, so a
    single `h1, h2, h3, h4` rule in `globals.css` reaches every heading in the
    app without editing a call site.
  - **NOT the serif a font-pairing article recommends first.** Playfair Display
    and Cormorant Garamond lead those lists and are wrong here: they are
    high-contrast display faces whose thin strokes break up below about 24px,
    and this site sets most headings between 18px and 30px. Source Serif is a
    text face with sturdy stems, so it holds at a section heading and still has
    presence in the hero, and it reads institutional rather than editorial,
    which is the right register for an exam.
  - **Headings get their own leading (1.15) and tracking (-0.018em).** Type set
    large needs less of both than body text and Tailwind's defaults are tuned
    for body. The tracking is deliberately small: past about -0.03em the letters
    collide in the strings this app actually sets, like "Quantitative Skills".
  - **The 19 small caps labels are one class** (`.label-caps`). They had drifted
    into several combinations of `text-xs`/`text-sm`, `font-medium`/
    `font-semibold` and `tracking-wide`/`tracking-widest` across nine files. No
    single one looked wrong, which is why it survived, and together they were a
    large part of why the type read as unconsidered.

  Two things were deliberately NOT done. **No new sizes and no new colors**: the
  size ramp and the color tokens were measured for contrast and are left alone.
  And **question prose stays in the sans**, because the real NMAT, GMAT and GRE
  all set their stems in a sans, and practice should look like the thing it
  practices for.

  **One claim was written and then removed after checking, which is the part to
  remember.** A `.tabular` utility was added with a comment calling it a bug fix
  for digit jitter on the timer. `components/Timer.tsx` already carried
  `tabular-nums`, and Tailwind ships that utility anyway, so the class was a
  duplicate API for something that already existed. It was dropped, and the two
  counters that genuinely lacked tabular figures got the utility instead. Adding
  CSS that nothing consumes is the same shape as the model fields this project
  shipped that no component ever read.

- Design philosophy: the user explicitly asked to model UI conventions on **first-world government websites (US/Canada/Singapore)** — USWDS, Canada.ca (GC Design System), Singapore's SGDS — researched live via WebSearch. Applied *principles* (restraint, accessibility, clear typographic hierarchy, minimal functional-only motion, visible focus states, 44px tap targets) rather than a visual reskin. Explicit user instruction: **"don't go for anything too fancy."** Do not redesign colors/spacing/typography wholesale without being asked again.
- Attempt state is **session-scoped and never resumed silently** (v1.6.0). The quiz shows a banner distinguishing resumed / already-submitted / expired attempts, each with a Retake action, and `components/SessionResetNotice.tsx` on the section-select page warns that progress is cleared when the tab closes, lists sections holding saved work, and offers "Clear saved progress". If you touch this area, keep the invariant: **any state restored from a previous visit must be stated in the UI.**
- **The timer is announced, not just colored** (v2.3.0). It carries a polite
  live region that speaks at 10, 5 and 1 minutes; before that it was a plain div
  with no role, so a screen-reader user got no warning of any kind before the
  section submitted itself under them. The digits are `aria-hidden` so the clock
  is not re-announced every second. Five minutes also changes the color, because
  the old sixty-second threshold is very late for a visual warning too.
- Timer (`components/Timer.tsx`): **deadline-based, not tick-counted.** As of v1.6.0 the deadline is owned by the quiz page and persisted (prop `endAt`, not `minutes`), so a reload resumes the same clock instead of granting a fresh section. Pausing persists `pausedAt` so a reload while paused doesn't charge the user for time spent paused; resuming reports the shifted deadline back via `onDeadlineChange`. It computes remaining time from `Date.now()` vs. a stored deadline on every tick, not by decrementing a counter — this was a real bug fix (browsers throttle `setInterval` in backgrounded tabs, which used to silently grant free exam time). Pause shifts the deadline forward by the paused duration. Has a `visibilitychange` listener for immediate correction on tab refocus. If you touch this file, do NOT reintroduce `Date.now()` calls inside the render body — React's `react-hooks/purity` lint rule will fail the build; deadline initialization must happen inside a `useEffect`.

## Known issues already fixed (context for why the code looks the way it does)

1. **Shared RC passage bug**: originally, some reading-comprehension questions referenced "the passage above," which could break under random 36-of-100 draw (the referenced question might not be in the drawn set). Fixed by embedding the full passage text directly in every question that needs it — verified zero cross-question references remain.
2. **`notFound()` from a Client Component**: the quiz page is a Client Component (`"use client"`), and originally called `notFound()` directly in its body — not a supported pattern per Next 16 docs. Fixed by adding a server-side `layout.tsx` that validates `examId`/`section`/`exam.available` and 404s *before* the client page renders; the client page now just has defensive fallback checks (no `notFound()` call).
3. **Currency `$` colliding with KaTeX delimiters**: `MathText.tsx` treats any `$...$` pair as math. Literal dollar amounts in word problems (`"$80 \times 0.75 = $60"`) caused mis-pairing and garbled rendering. Fixed by switching question content to the peso sign (₱) rather than making the parser smarter — simpler and more contextually correct for a Philippine exam. If you add new money-related question content, use ₱ from the start.
4. **Timer drift on backgrounded tabs** — see Timer section above.
5. **`saveStoredProgress` had no try/catch** (read path did) — a throwing `localStorage.setItem` (Safari private browsing quota) could crash the quiz on the first answer click. Fixed to match the read path's silent-fallback pattern.
6. **Mobile users had zero sidebar access** — fixed with `MobileNavSheet`.
7. **Sub-44px tap targets** on PauseOverlay's Resume button, ThemeToggle, header buttons — bumped to 44px (accessibility minimum).
8. **Color-only correctness indicator** — fixed with text markers (see above).
9. **`MobileNavSheet` had no focus trap/Escape/scroll-lock** when first built — I (the agent) caught this myself in a follow-up self-review after background review agents hit the session's API rate limit mid-task. Fixed before merging.
10. **Focus never returned to the control that opened an overlay**, though both PauseOverlay and ConfirmDialog contained a comment saying it did (fixed v2.3.0). They captured `document.activeElement` inside their open effect — but React applies every DOM mutation for a commit BEFORE running passive effects, and the commit that opens either overlay is the same commit that marks the runner `inert`. A focused element becoming inert resets focus to `<body>`, so both were faithfully restoring focus to `<body>`. It looked correct, and it genuinely IS correct on the exam-setup page, which marks nothing inert — which is how it survived review. **`lib/last-focused.ts` tracks `focusin` instead**, since focus moving away fires `focusout`, so the trigger survives the inert reset. A layout effect does not help; mutations still run first.
11. **`MobileNavSheet` had no focus trap, no dialog role and no focus management** (fixed v2.3.0) — despite item 9 above recording all of it as fixed. Only Escape and the scroll lock ever landed. The "Sections" button is inside the `inert` wrapper, so opening the sheet dropped focus to `<body>` and Tab then walked the site header, i.e. the page behind an `aria-modal` dialog, before ever reaching the sheet.
12. Two pre-existing lint false-positives were cleaned up (`ThemeToggle`'s `react-hooks/set-state-in-effect`, `ThemeInitScript`'s `@next/next/no-before-interactive-script-outside-document` — both are legitimate patterns the lint rules don't account for; each has an inline `eslint-disable` comment explaining why).

## PR/version history (what shipped, in order)

- **PR #26** (v2.8.0) — the GMAT bank stops being a seed: 90 questions per
  section, 32 hard in each, and five options everywhere the real exam has five.
  See "GMAT specifics" above for the gap list it closes.

  **Its review lanes found the same thing from two directions, and the audit
  could not see it.** The longest-option check asks "is the key THE longest
  option", and GMAT Verbal passed at 26.7% against 20% by chance while a
  candidate guessing between the TWO longest scored 57.5% against 40%. It
  passed because two opposite artifacts cancelled inside one file: the 60 newly
  written questions keyed the longest option 40.7% of the time, and the 30 that
  had a fifth option retrofitted keyed it 0%, because the added distractor was
  usually the longest string. Either half alone would have failed.

  Three of the four holes in `audit-bank.mjs` were one hole: **a threshold
  written as a literal, calibrated on conditions that had since changed.** Every
  band assumed four options and a hundred-question file, and both assumptions
  had expired. Bands are now standard errors from a per-bank chance rate. See
  "Every guessing heuristic is now scored in standard errors" above.

- **PR #27** (v2.8.1) — the content items #26's lanes raised that were not worth
  rushing into that merge. Four pairs of Reading Comprehension questions had
  their own passages but shared a SUBJECT, so a 23-of-90 draw served the same
  topic twice; one of each pair moved to a new subject. Nine Critical Reasoning
  stimuli ran 19 to 44 words against a real 60 to 120 and were arguments only in
  outline. Three items tested one interchangeable analogy-transfer move.

  **The interesting constraint was not doing harm.** #26 had just removed an
  option-length bias, and writing 14 new option sets in one pass is exactly how
  it would come back. The two statistics were set as hard targets and measured
  before and after, landing at 23.6% and 36.6% against chance rates of 20% and
  40%. **A pass that fixes its own target and breaks a neighboring one is this
  project's most repeated mistake**, and it is why every bank-wide edit here now
  re-measures everything rather than the one number it set out to move.

- **PR #23** (v2.5.0) — the copy reads as written by a person, at the user's
  direction: "they reeked too much of AI slop." This is a different complaint
  from the one v2.4.0 answered, and **v2.4.0 is part of what caused it.** STE
  fixed the vocabulary and left the rhythm alone. Its rules cap sentence LENGTH
  and ask for one instruction per sentence, so the obedient way to write it is a
  column of 17-word subject-verb-object declaratives, and that metronome is the
  single loudest machine-written tell. Nothing in ASD-STE100 asks for uniform
  length, and the fix was to vary it: the hero subhead now runs 21 / 18 / 8
  words.

  The other three patterns, worth naming because they regrow:

  - **The pull-quote heading.** "One timed section shows you where you stand"
    and "An adaptive exam adapts" are epigrams, not headings. The second also
    broke the settled vocabulary, since **"follows" is reserved for *conforms
    to*** and difficulty **changes with** your answers.
  - **The closing one-liner.** Two feature paragraphs ended on a line that
    existed for the cadence rather than the reader ("Practice without a time
    limit teaches you the topics but not the exam"; "A good incorrect option
    matches a real mistake"). Both are also "not X, but Y" contrasts.
  - **The triad.** A hero chip row of exactly three items, a stat band of
    exactly four, and a "not one quiz under different names" negative listing.

  Two whole bands were **deleted** on the user's explicit instruction: the
  four-cell stat band and the hero chip row. Every fact in them appeared
  elsewhere on the page already. The home page no longer has a `StatBand`
  component.

  **`npm run audit:copy` cannot see any of this and was never going to.** It
  checks tense, sentence length, semicolons and a banned-phrase list. It passed
  before this PR and passes after, at 268 strings against 274 (the drop is the
  deleted bands). Rhythm, pull-quotes and triads stay an author-and-reviewer
  judgment, in the same bucket as Rule 3.7 and dictionary membership.

- **PR #24** (v2.6.0) — the GRE General Test, and the engine work it forced. An
  answer stopped being an option index: `Question.kind` adds multi-select and
  numeric entry, because GRE Sentence Equivalence requires exactly two of six and
  Numeric Entry has no options at all. `lib/answers.ts` owns every comparison,
  since `!==` is silently wrong for an array. 192 original questions across two
  sections, written by eight authors one file each. `CalculatorKind` gained
  "not-simulated", `ScoringModel` gained `scoreStep`, and `ExamModule` gained
  `notes`. See "THE GRE, AND THE QUESTION KINDS IT REQUIRED" above.

  **A real browser found a bug nothing else could**, and it is the third
  instance of one pattern in this repo: two multi-select clicks in one frame
  collapsed to one, because the card computed the new answer from a PROP that
  React had not re-rendered yet. Deriving new state from a prop inside a click
  handler is the bug; the state updater's `prev` is the only fresh source.

- **PR #22** (v2.4.0) — every user-facing description rewritten to ASD-STE100,
  at the user's direction, because the old copy read as machine-written
  marketing. The home page hero, stat band, exam picker, three feature bands,
  seven FAQ answers and the closing CTA, the generated "what to expect" list,
  both exam modules and all six section descriptions, every quiz notice and
  confirm dialog, the results screen, the calculator explainer and all four
  failure pages. Also `npm run audit:copy`. See "Language: Simplified Technical
  English" above for the rules and the settled vocabulary.

  **A shortening pass is how a hedge silently becomes a promise, and this one
  did it five times before review caught them.** Worth reading as a list,
  because the next copy pass will be tempted the same way: "written originally
  for this site" became "a person writes every question", a stronger and
  different claim, in four places including the legal disclaimer; the
  affiliation notice narrowed its non-endorsement to GMAC alone and swapped
  "reproduce" for the narrower "copy"; the expired-attempt banner stopped saying
  the section had been SUBMITTED, above a score the reader did not ask for; the
  resumed banner's "has been running since then" became "continued after that",
  which permits "it ran on for a while and then stopped"; and the calculator
  note's rewrite of the `%` key was wrong in its own worked example. Three
  review lanes each found some of these and none found all of them.

- **PR #21** (v2.3.0) — the full-department audit: six parallel review lanes (logic,
  visual design/motion, security, question-bank content, new-user UX, performance)
  followed by fixes. Three wrong answer keys; the 96% middle-two exploit; a focus
  ring that was invisible on the home page's primary CTAs; focus restoration that
  had never worked inside the quiz; security headers and the auth kill switch;
  KaTeX code-split off two sections that contain no math; the 36-card re-render per
  click; the dark-mode flash. Details are in the relevant sections above rather than
  here. New standing tools: `npm run audit:bank` and `.githooks/pre-commit`.

- `e824c05` (v1.0.1) — established the semver + branch/PR workflow itself.
- `c1fc6be`/`643e08e` (v1.1.0) — UI redesign: theme system, sidebar nav, resumable sessions.
- `2822aa7`/`9ec622c` (v1.2.0) — expanded question bank to 300 (100/section), random-36-draw-per-attempt.
- **PR #4**, `305160c` (v1.3.0) — the big `reminders.txt` batch: multi-exam architecture, KaTeX math rendering, sticky header, pause overlay, page transitions, brand accent color, full content overhaul (topic ratios, difficulty, em-dash removal) across all 300 questions.
- **PR #5**, `2b26e9a` (v1.4.0) — post-merge autonomous audit (5 background agents: 3 design-system research, 2 bug hunts) + fixes: timer drift, localStorage write crash, mobile nav, tap targets, focus rings, lint cleanup.
- **PR #6**, `f0e6707` (v1.4.1) — follow-up fix: color-only correctness indicator.
- **PR #7**, `d3479a6` (v1.5.0) — response to user's post-PDF-review feedback batch. Fixed a severe pre-existing bug found while investigating (not explicitly reported): the correct answer's option slot was heavily skewed toward A bank-wide (logical-reasoning was 86/119 correctIndex 0, several topics literally 100% "always A") — fixed with a mechanical options-array shuffle across all 300 questions. Also: Para Forming (10 questions) had the printed P/Q/R/S line order always exactly matching the correct sequence, plus telltale concluding adverbs marking the last sentence — both fixed. Sentence Completion (12 questions) had distractor sets that were 3 near-synonyms vs. 1 obvious answer — rewritten to be individually plausible. Reading Comprehension trimmed 26→18 (two whole passages retired), replaced with 8 new "Vocabulary in Context" questions. Topic-bunching fixed via a display-order interleave (`interleaveByTopic`, which lived in `lib/data/questions.ts` then and is in `lib/question-bank.ts` now; best-effort, not a hard guarantee for topic-imbalanced draws). PauseOverlay copy simplified + crossfade transition added. ProgressTracker now stays visible after submission and color-codes cells green/red.

- **PR #9** (v1.6.0) — session lifecycle / error-handling fix. The user reported being confused by an old session that had "timed out". Two stacked defects: progress was written to `localStorage` with no expiry (so a half-finished or already-submitted attempt survived browser restarts forever), while the timer restarted at full length on every mount — pairing an old question set and old answers with a fresh clock, and dropping a resumed submitted attempt straight into review mode with no explanation. Fixed by moving progress to sessionStorage, persisting the timer deadline (plus `pausedAt`), and never resuming without saying so. See the sessionStorage/Timer/`SessionResetNotice` notes above.

- **PR #10** (v1.7.0) — LaTeX normalization + rendering/UX batch. Bank-wide conversion of raw-text math to LaTeX; `a/an` before blanks (ls-062 was leaking its answer outright, since only the correct option was vowel-initial after "an ___"); `ls-090` analogy rekeyed to "Investigator". Timer rebuilt around a boundary-aligned self-rescheduling timeout with `Math.ceil` (a drifting `setInterval` plus `Math.round` was visibly skipping seconds). Fractions fixed via `\displaystyle` in `MathText`. Saved-attempt rows made clickable; sections now scroll to the results on submit. Pre-existing bugs fixed: an earlier `$` → `₱` pass had eaten opening math delimiters at 8 sites; 8 circular-seating questions had a self-contradictory facing convention that left 3 of them unsolvable; 6 explanations still referenced pre-shuffle option letters, 2 of which called the correct answer wrong.
- **Review lanes are now mandatory per PR** (see CLAUDE.md): logic, syntax/display, UX, content correctness. Their first run (PR #10) found the unsolvable seating puzzles, the drifted explanations, and proved a CSS "fix" of mine was a measured 11% regression. Take their findings seriously and verify claims independently.

- **PR #13** (v1.11.0) — home landing page + audit fixes + hosting readiness. The home page was a bare gateway (hero, exam list, two placeholder cards); it is now a real landing page modeled on the structure of cseexamreviewer.com at the user's request: accent hero band, stat row, per-section cards, how-it-works, three alternating feature bands, a "more exams" block, a native `<details>` FAQ, a closing CTA, plus a new `SiteFooter` carrying the GMAC non-affiliation disclaimer. `SiteHeader`'s three inert "soon" chips became real exam links. Audit fixes shipped alongside: `body { font-family: Arial }` had been silently overriding the Geist webfont app-wide since the starter template; `--accent` failed WCAG as text in dark mode (3.11:1) so `--accent-text` was added, derived via `color-mix` so it tracks each exam's accent; PauseOverlay opened with focus on `<body>`; `handlePause`/`handleDeadlineChange` wrote render-closure `answers` to storage and could lose an answer to a same-frame race. Hosting groundwork: `generateStaticParams` + `dynamicParams = false` on both dynamic segments (every route is now build-time prerendered, zero on-demand server rendering), `metadataBase` + title template + per-exam `generateMetadata`, `robots.ts`, `sitemap.ts`, `not-found.tsx`, `error.tsx`, JSON-LD on the home page, and `lib/site.ts` holding `NEXT_PUBLIC_SITE_URL` and the disclaimer.

- **PR #20** (v2.2.0) — the on-screen calculator for GMAT Data Insights, plus explicit "no calculator here" copy on the sections that grant none. The engine is a pure reducer asserted by `verify:engine`. Review established that the real device is an emulated TI-108, which invalidated four details the first implementation had guessed at or imported from the pre-Focus calculator. Full detail in "The on-screen calculator" below; read it before touching either file.
- **PR #18** (v2.1.0) — the accounts backend: Neon Postgres, Drizzle with committed migrations, better-auth email/password, one dynamic API route. No user-facing change; there is still no sign-in UI and no route requires a session. Full detail in "THE ACCOUNTS BACKEND" below, including two config options that better-auth silently ignored.

## Known non-issue: NMAT has THREE sections, and this is correct

A review lane reported that "mirrors the real exam: 108 questions across 3
independently-timed sections" is an overclaim, on the grounds that NMAT Part I
has four subtests (Verbal, Inductive Reasoning, Quantitative, Perceptual
Acuity). **That is a different exam.** Those are the sections of the Philippine
*National Medical* Admission Test. This app targets **NMAT by GMAC**, the
graduate management admissions test, whose Official Guide 2021 uses exactly
Language Skills, Quantitative Skills and Logical Reasoning.

Checked against the reference guide before changing anything: "Language Skills"
appears 14 times, "Quantitative Skills" 13, "Logical Reasoning" 20, and
"Perceptual Acuity" and "National Medical" **zero**. The two exams share a name
and a country and nothing else. Expect this to be raised again; the copy is
right and should not be softened.

## Known non-issue: the answer-key distribution

A separate Claude session reported (2026-08-21) that the correct answer sits in slot 1 for 86% of Logical Reasoning questions and 49% overall, and that `ls-010`'s explanation was a copy-paste slip about "malevolent/vindictive/benevolent/altruistic". **Both were checked against the files on disk and both are false.** The measured distribution is 25.0 / 22.0 / 27.7 / 24.3 / 1.0 percent across indices 0-4 of all 300 questions (the 1% at index 4 is the 11 quantitative questions with five options), and `ls-010` carries a correct, on-topic explanation about sleep and memory consolidation. The word "malevolent" appears nowhere in the bank. The reported 86% figure is verbatim the pre-v1.5.0 bug that PR #7 already fixed, so that session was almost certainly reading a stale snapshot. Re-measure before acting on a claim like this:

```bash
python -c "import json,io,collections; c=collections.Counter(); [c.update([q['correctIndex']]) for n in ['language-skills','quantitative-skills','logical-reasoning'] for q in json.load(io.open(f'data/questions/{n}.json',encoding='utf-8'))]; print(c)"
```

## Hosting

**Deployed on Vercel (Hobby), as of v2.0.1.** Chosen over Cloudflare because Next.js is Vercel's own framework, so there is no adapter and no build configuration, and because API routes run natively there when the accounts backend arrives. The Hobby plan never bills (it pauses at the limit) but **forbids commercial use** — ads, payments or a paid plan mean upgrading or migrating to Cloudflare Workers, which is about a day's work since nothing depends on Vercel-specific APIs.

**This changed at v2.1.0 and the old claim is worth stating so it is not re-copied: there used to be "no database, no runtime secret, and no request-time work." All three are now false.** The build emits exactly ONE dynamic route, `ƒ /api/auth/[...all]`; every page is still `○ (Static)` or `● (SSG)`, and that invariant is worth checking in the route table after any change. See "THE ACCOUNTS BACKEND" below for the database, the secret, and the traps.

`SITE_URL` lives in **`lib/site-url.ts`**, not `lib/site.ts`, and that split is load-bearing: it reads a non-`NEXT_PUBLIC_` variable, so if it were ever bundled for the browser it would silently resolve to localhost. `lib/site.ts` keeps only client-safe constants. The URL module also carries `import "server-only"`, which turns importing it from a Client Component into a build error rather than a silent one (verified by deliberately doing it). It resolves at build time from `NEXT_PUBLIC_SITE_URL`, then Vercel's automatic `VERCEL_PROJECT_PRODUCTION_URL`, then localhost. The middle step exists specifically so a deploy that forgets the first cannot silently publish a sitemap and a full set of canonicals pointing at `http://localhost:3000`. **Only set `NEXT_PUBLIC_SITE_URL` once a custom domain exists.** Every consumer of `SITE_URL` is a Server Component or metadata route; check that before importing it into anything marked `"use client"`, since the Vercel variable is not `NEXT_PUBLIC_` and would be undefined in a client bundle.

### Review-lane findings applied in the same PR

All four lanes ran. Beyond the items above they surfaced, and this PR fixes:

- **The section lock was never enforced.** The app has always told users a section locks you in until you submit ("just like the real exam") and SectionNav has always grayed out the other two, but the graying was cosmetic and every page linked straight to every quiz URL. Starting a second section left two clocks burning, the first silently bleeding out. `findActiveAttempt()` in `lib/section-result.ts` is now the real check: the quiz page renders a lock screen instead of drawing a set, and the home page's per-section CTA (`components/SectionStartButton.tsx`) reflects start/resume/review/blocked instead of always saying "Start". An expired-but-unsubmitted attempt deliberately does NOT block, or the user would be stranded; a paused one does.
- **`--accent-text` did not track the per-exam accent, and its comment claimed it did.** A custom property containing `var()` is substituted at the element that DECLARES it; declared on `:root` it is permanently bound to `:root`'s `--accent`. Fixed with a `.exam-theme` class carried by the per-exam wrapper that re-declares it. **If you add another accent-derived token, put it in both places.**
- **PauseOverlay rendered for 200ms on every quiz mount** (no first-mount guard on the exit effect), which the newly-added `aria-modal` turned into a phantom modal. Also now restores focus on resume and traps Tab.
- **Root-layout metadata was inherited by every child**: `canonical: "/"` and `og:url: "/"` on the root layout made every quiz page a declared duplicate of the home page, sharing one tab title.
- **`robots.txt` Disallow fought the `noindex`** — a blocked crawler never reads the tag. Disallow removed; `noindex` alone is stronger.
- RC prompts embed their passage; it is now split from the stem and rendered as a distinct block. The split boundary is `[.!?]"\s+(?=[A-Z])`, NOT the last quote (vocabulary stems quote the tested word) and NOT the first (passages contain quoted speech). Self-guarding: a stem not ending in `?`/`:` falls back to unsplit. 18/18 split, 282 non-passage prompts untouched.
- `interleaveByTopic` now prefers no two adjacent questions to share a topic (was: no more than two in a row). The old greedy largest-first pick meant every attempt opened with a matched pair. Measured over 400 draws per section: zero adjacent same-topic pairs.
- Scores now show `21 / 108` plus a percentage and an explicit "this is not an NMAT scaled score" note; progress-grid legend leads with color; `/gmat` shows its mapped-out format instead of being a dead end; quiz header no longer truncates the h1 to "Langua…" at 390px; pause overlay shows the frozen clock.

- **PR #14** (v1.12.0) — question-bank statistical + correctness pass, closing the length-bias hole PR #7 left open. No app code changed. Details in "Answer-key statistics" below.

## THE MODULAR EXAM ARCHITECTURE (read this before adding anything)

As of v2.0.0 exams are drop-in modules. **`lib/exams/registry.ts` is the only file that lists exams.** To add one: write `lib/exams/<id>/index.ts` default-exporting an `ExamModule`, put its JSON under `data/questions/<id>/`, and add one line to that registry. Routes, home page, setup page, section lock, sitemap, footer and the quiz engine all read from it.

The contract is `lib/exams/types.ts`. The crucial idea is that an exam declares how it BEHAVES as data, so the engine never branches on an exam id:

- `rules.navigation` -- `"free"` (NMAT: whole section on a page, skip and revisit) or `"sequential"` (GMAT: one at a time, no going back). This picks the runner.
- `rules.allowSkip`, `rules.adaptive`, `rules.reviewEdit`, `rules.sectionOrder`, `rules.lockToOneSection`, `rules.optionalBreakMinutes`
- `scoring` -- `points` (NMAT, marks per correct) or `scaled` (GMAT, 205-805 weighted by difficulty with an unanswered penalty)

**If you are about to write `if (examId === "...")` outside `lib/exams/`, add a rule instead.** The exam setup page's "what to expect" bullets and the home page's per-exam highlights are both GENERATED from `rules`, which is deliberate: the old hand-written copy claimed a section lock that did not exist for months.

Files: `lib/exams/{types,registry}.ts`, `lib/exams/{nmat,gmat}/index.ts`, `lib/question-bank.ts` (lazy per-section loading), `lib/adaptive.ts`, `lib/scoring.ts`, `components/quiz/{useAttempt.ts,FreeFormRunner.tsx,SequentialRunner.tsx,shared.tsx}`, `app/[examId]/quiz/[section]/page.tsx` (a shell that picks a runner).

Small shared modules added in v2.3.0, each existing because the same bug was about to be fixed at three call sites:

| Path | What it is |
| --- | --- |
| `lib/last-focused.ts` | Tracks `focusin` so overlays can return focus to their trigger. Read the note in the file before replacing it with `document.activeElement`, which is what it exists to correct. |
| `lib/motion.ts` | `prefersReducedMotion()` / `scrollBehavior()`, for motion CSS cannot reach — a `scrollIntoView` option has to be chosen at the call site. |
| `components/MathSpan.tsx` | The KaTeX boundary. Dynamically imported by `MathText`, and the ONLY place `react-katex` and `katex.min.css` are referenced. |
| `scripts/audit-bank.mjs` | `npm run audit:bank`. See "Answer-key statistics". |
| `scripts/audit-copy.mjs` | `npm run audit:copy`. See "Language: Simplified Technical English". Added v2.4.0. |
| `.githooks/pre-commit` | Blocks staging copyrighted material or a credential. Needs `git config core.hooksPath .githooks` once per clone. |

`useAttempt` holds ALL attempt state for every exam: storage, timing, pause, expiry, the section lock, adaptive serving, scoring, the review pass. Runners are presentation only.

### Question banks are now lazily loaded per section

`lib/question-bank.ts` dynamic-imports one section at a time and caches it. Previously every bank was statically imported into one module, so ~220 KB of questions sat on the critical path of the exam setup page and of every quiz section including the two you were not taking. `getSectionBreakdown` no longer touches the bank at all: the score is written into sessionStorage at submit time as `StoredProgress.summary`. Verified after the change: each section's bank is its own chunk and none is referenced by any route's client manifest.

**The sync/async split matters.** `loadSection()` is async and must be awaited once (the quiz page does it in an effect); `getLoadedSection()` is the synchronous cache read used during render.

**Strict Mode trap, already hit once:** the loader effect is deduped by a ref, so it must NOT cancel its own in-flight promise on cleanup. React double-invokes mount effects in dev as mount-cleanup-mount; canceling killed the only run that was allowed to proceed and the quiz hung on a blank screen.

### GMAT specifics

GMAT Focus: Data Insights 20q, Quantitative 21q, Verbal 23q, 45 minutes each, 64 questions, 205-805. Verbal has NO sentence correction; Quantitative has NO geometry; Data Sufficiency belongs to **Data Insights**, not Quantitative. The bank is **270 questions** as of v2.8.0, 90 per section with 32 hard in each, so the adaptive ladder no longer runs dry.

**The GMAT bank was a 90-question seed until v2.8.0, and every gap that came
with it is now closed.** The list is kept because the fixes are the interesting
part, and because the same holes are the ones a future exam will dig:

- **Four options where the real exam has five.** Verbal, Quantitative and the
  non-Data-Sufficiency half of Data Insights all used four. That moves a blind
  guess from 20% to 25%, and on an ADAPTIVE exam it is not a rounding error: it
  shifts every difficulty estimate the ladder makes. All 270 questions now carry
  five, each retrofitted distractor tracing to one named mistake.
- **30 questions per section against sections of 20 to 23.** A retake re-served
  about 77% of the same paper, and a strong run exhausted the ten hard questions
  and fell back to medium. Now 90 per section: the draw ratio is about 0.24 and
  there are 32 hard questions per section.
- **CR stimuli ran 18 to 34 words** against a real 60 to 120, which is not an
  argument. New items run 74 to 126.
- **RC passages ran 110 to 121 words** against a real 200 to 350, and worse,
  **four PAIRS of questions were sharing one passage** (`gv-006`/`gv-007`,
  `gv-013`/`gv-014`, `gv-020`/`gv-021`, `gv-028`/`gv-029`), so a draw could
  serve the same text twice. Every question now carries its own passage of 250
  to 320 words.
- **10 of 25 CR items used one "find the alternative cause" template.** The new
  set spans eight stems and a deliberate range of argument structures: sampling,
  analogy, cost-benefit, plans and predictions, statistical fallacies,
  definitional shifts, survivorship, and boldface role.
- **Four questions were tagged Two-Part Analysis and were not.** Real Two-Part
  Analysis is a two-column table taking one selection per column. The `multi`
  question kind does NOT close that gap either, because picking two options from
  one shared list loses which column each belongs to. Rather than mislabel or
  delete them, they were rewritten as genuine Table Analysis questions with
  embedded tables. **If Two-Part Analysis is ever built properly it needs a new
  question kind, not a reuse of `multi`.**

Two lessons from the pass itself, both worth more than the numbers:

**Adding an option cannot rescue a key that is already bracketed.** A key
sitting mid-range among four values stays mid-range whatever fifth value is
added, so a retrofit can only protect the extremes that already exist. Two more
were surrendered deliberately, because the only realistic distractor sat above
the key and a rank-preserving alternative would have been contrived. **A weaker
distractor is a worse question than a slightly worse statistic**, and that is the
right way to resolve the tension.

**A fixed option set forked without anyone noticing.** The second authoring pass
wrote Data Sufficiency's five statements with different capitalization from the
first, giving one bank two variants of a set whose entire point is that it never
varies. `audit:bank` now fails on that, per bank rather than globally, since
NMAT and GMAT may legitimately word theirs differently.

`npm run verify:engine` asserts (and exits non-zero) on the adaptive ladder and both scoring models. It has already caught three real bugs: a perfect attempt scoring 810 on a band whose maximum is 805, difficulty weighting being a no-op, and timing out scoring higher than finishing. **Run it after touching `lib/adaptive.ts` or `lib/scoring.ts`.**

### The on-screen calculator (v2.2.0, PR #20)

`lib/calculator/basic-di.ts` models the calculator GMAT Focus provides in **Data
Insights and nowhere else**. It is a pure reducer with no React, no DOM and no
imports, which is what lets `npm run verify:engine` assert it directly; 40 of the
script's assertions are now calculator behavior. `components/quiz/CalculatorPanel.tsx`
is the keypad and nothing else.

**Availability is declared per section**, on `SectionConfig.calculator`, NOT on
`ExamRules` — it is the one thing that varies between sections of a single exam.
The field is **required, not optional**, so all six sections say `null` out loud.
That is deliberate: "no calculator" is a rule the UI states, and an optional field
would let a new section default into silence.

**The device is an emulated Texas Instruments TI-108.** Write that down before
researching anything about it, because the TI-108 is documented and most GMAT prep
material is not describing it. A source that mentions a `1/x` key, `MS`/`MR`/`MC`,
or separate `BS`/`CE`/`CA` keys is describing the **pre-Focus Integrated Reasoning**
calculator and its other details should not be trusted either. The first
implementation of this feature copied three separate details from that older device.

Behaviors that look like bugs and are not. Each is asserted, and the assertions
exist as much to stop someone "fixing" them as to catch a regression:

- **No order of operations.** Strictly left to right, so `2 + 3 × 4` is 20. There
  are no parentheses. The workaround is the memory keys, and both the naive and the
  `M+` path are asserted.
- **`%` is contextual.** With a pending `+`/`-` it takes the percentage OF the
  accumulator (`12 + 10 %` shows 1.2, `=` gives 13.2). Only under `*`/`/` or with
  nothing pending does it divide by 100.
- **Repeated `=` repeats the last operation** (the automatic constant):
  `3 + 2 * 5 = = =` is 625.
- **The display is 8 digits.** Past 99,999,999 it errors and only `ON/C` recovers.
  Memory has the same ceiling. This is tighter than it looks and is reachable in
  real DI arithmetic — which is the point, since a calculation that fails on test
  day must not quietly succeed here.
- **One `ON/C`, no backspace.** First press clears the entry, second clears the
  calculation; memory survives both and is cleared with `MRC` twice.

One thing is genuinely still unknown: what a **repeated operator** does. The
automatic constant suggests `3 + +` yields 6; we treat a second operator as
replacing the pending one, since correcting a mistype is the commoner intent. The
only sources describe this through a third-party simulator's own MDAS toggle.

**Traps this feature has already sprung:**

- **Do not overload `entryMode` as the fold condition.** It means "the next digit
  replaces the display", NOT "an operand has been supplied since the operator".
  Those come apart for `√`, `%`, `MRC` and a cleared entry, and the operator branch
  then overwrote the accumulator: `2 + 9 √ × 4 =` gave 12 instead of 20. There is a
  separate `operandReady` flag for this. The tell was that `=` and the operator
  branch disagreed about identical state.
- **The panel is `absolute` inside a `sticky` wrapper, so page scroll does not move
  it.** Anything past the fold is unreachable at *every* scroll position, not merely
  awkward. It is capped with `max-height` and scrolls internally. The explanatory
  note has been in three places for this reason: at the bottom it could not be
  reached on a 1366x768 laptop, and in full above the keypad it pushed the digits
  off screen. It is now a one-line banner above plus a collapsed disclosure below.
- **The panel width and its breakpoint are ONE decision.** The column is `max-w-3xl`
  with `px-6`, so the shifted panel's left edge is `(viewport - 768) / 2 + 24` minus
  gap minus width. At 15rem + 1rem that is positive at exactly 1280, which is why
  `xl` is right; at the original 17rem + 1.5rem the panel hung 40px off the left of
  the screen between 1280 and 1360. Widening it without raising the breakpoint
  reintroduces that.
- **`calcVisible` must match the `inert` condition, not just `paused`.** The panel's
  Escape handler is on `document`, and `inert` blocks pointer and focus but not a
  document-level keydown, so one Escape aimed at the confirm dialog also collapsed
  the calculator.
- **The no-calculator note renders only where the same exam grants one elsewhere.**
  Unconditional, it told NMAT Language Skills readers that a preposition question
  was "meant to come out through reasoning and estimation" and implied some other
  NMAT section had a calculator. NMAT has none anywhere.
- **There is deliberately no keyboard entry.** Every key is a focusable `<button>`
  so Tab-and-Enter works, but no keydown handler maps number keys: the real one is
  mouse-driven, and type-to-enter would hand a practicing student a speed advantage
  that evaporates on test day. It will read as a missing feature; it is not.

Not done, and known: the real calculator is **draggable** around the screen and ours
is a fixed popover. Calculator state is also not persisted, so a reload mid-section
keeps the attempt but wipes a banked memory value.

### Scoring traps that were live and are now asserted against

1. **The scaled denominator must be a FIXED reference**, not the weight of what was served. Normalizing by served weight made `difficultyWeight` do nothing: any all-correct run scored 805, so sweeping easy questions beat a strong partial run on hard ones.
2. **`scoreAttempt` takes the section's real length.** Scoring only what was served made timing out after four questions score 675/805 while a genuine 50% run scored 505. Unreached questions count as unanswered.
3. **An expiry discovered on load must write a `summary`.** Writing `submitted: true` with `summary: null` made every screen outside the quiz report a real result as 0 correct. A submitted record without a summary is now treated as an unknown score and shown as a bare "Submitted".

### Other traps this architecture has already sprung

- **The review pass allowance is derived from a baseline snapshot, not counted per click.** Counting clicks made a misclick cost two of three changes.
- **`findActiveAttempt` and section totals must use `section.questionCount`,** never `stored.questionIds.length`: on a sequential exam the served list grows as you go, so a 20-question section read "4 of 5 answered".
- **`restart()` needs the same section-lock check the load path has.** Without it, Retake was a way to get two clocks running.
- **`MathText` applies `\displaystyle` only to spans containing a fraction.** Applying it to everything swelled superscripts so `$x^2$` rode into the line above.
- **Per-exam accents must be measured, not picked.** GMAT's first blue was 1.59:1 on the dark background, half of NMAT green's 3.11:1, which made the selected-option ring fainter than the neutral borders around it. `#2563eb` matches NMAT's profile.
- **Generated copy has to match the rules.** The break bullet claimed Pause implements the exam's timed break budget; nothing enforces one. If a rule has no engine behind it, say what the app actually does.

### Answer-key statistics — now enforced by a script, not by this document

**Run `npm run audit:bank` rather than trusting any number written here.** Every
statistical claim this project has made about the bank used to live in this
section as prose, get doubted, and get re-derived from scratch; one of those
re-derivations turned out to be a session reading a stale snapshot, and cost a
full investigation to disprove. `scripts/audit-bank.mjs` exits non-zero when a
guarantee is breached, so a bias that was solved once cannot quietly return.

It checks the key spread per file, the longest-option heuristic, where the key
sits among numeric options, KaTeX parseability of every math span, raw control
characters, duplicate option VALUES (not merely duplicate strings),
self-containment, option-letter references in explanations, and the difficulty
mix.

**Options are NEVER shuffled at runtime, and this is the fact the whole section
turns on.** `lib/question-bank.ts` shuffles which QUESTIONS are drawn for an
attempt; it has never shuffled the options within one. PR #7's shuffle was a
one-time mechanical pass over the files. So the stored order is exactly what
every candidate sees on every attempt, and any slot pattern in the JSON is a
pattern in the product.

That is why the per-file slot spread is not enough on its own: **a candidate
practices one topic at a time, and a per-file average hides a loaded topic
completely.** Measured in v2.3.0, while every per-file number looked healthy:
Para Forming keyed the LAST option in 8 of 10 questions, so clicking the fourth
option without reading scored 80% on that topic, and Critical Reasoning: Weaken
keyed the second in 4 of 4. 281 questions were re-slotted (by swapping two
entries in `options`, so every keyed VALUE is provably unchanged), and
`audit:bank` now fails on any topic where one slot holds more than 50% of the
keys. Data Sufficiency is exempt and must stay exempt: its five options are a
fixed memorized order on the real exam.

Five "answer without reading" strategies have been measured, fixed and
re-measured. The last two were found in v2.3.0 and were by far the strongest:

| Strategy | Before | After | Chance |
| --- | --- | --- | --- |
| Always pick slot 1 | 25.0% (fine since PR #7) | 25.9% | 25% |
| Pick the longest option (prose questions) | 47% overall; **94.7% on Critical Reasoning** | **21.2%** overall | 25% |
| **Cross off the largest and smallest number, guess between the other two** | **96.0%** | **59.5%** | 50% |
| **Click the same slot every time, within one topic** | **100%** on Weaken, **80%** on Para Forming | max 40% on any topic | 25% |
| Para Forming: assume the answer starts with Q | 8 of 10 keys opened with Q | P3 / Q3 / R2 / S2 | even |

The middle-two finding is worth understanding rather than just recording,
because its cause is a habit any future author will share: building distractors
by nudging the correct value up AND down brackets it structurally. A candidate
who read nothing scored 48% across the entire numeric portion of both exams. The
fix moved 42 keys to an extreme, **alternating direction** — pushing them all one
way would simply have minted "always pick the largest", which is why the audit
tracks both extremes separately, each against its own 25% baseline.

Two questions are knowingly left as middle-key hits, and this is not an
oversight: `qs-073`'s answer is a count of 2 drawn from 0-4, and `qs-079`'s is
the middle of five plotted years, so no four-option set can place either at an
extreme without rewriting the prompt. **They were briefly "fixed" by writing the
options as "2 students" and "Year 2021", which did not remove the bias — it
removed the questions from the audit's numeric pool.** The parser now strips any
leading or trailing unit word specifically so that dodge cannot work, and it
consequently sees 131 numeric questions where a narrower one saw 99.

**A mechanical fix for one bias can mint another, and this one did.** The
re-slotting script's round-robin restarted at slot 0 for every topic, so every
topic with fewer than four questions fed only the low slots -- and a
30-question GMAT bank is mostly small topics. Bank-wide "always pick A" went
from 25.6% to **33.1%**, and GMAT Quantitative to **56.7%** (17 of 30, six
consecutive at one point). That is a bigger hole than the per-topic clustering
the pass was closing, and it undid a property already fixed twice, in PR #7 and
PR #14. The counter now runs ACROSS topics within a file rather than resetting.

**The audit did not catch it, and that hole is worth remembering too:** the
per-file slot check skipped files under 100 questions, on the reasoning that a
sample of 30 is too noisy to judge. "Too small to judge precisely" is not "too
small to judge at all". The band now widens for small files instead of
disappearing, and the fix was verified by running the new audit against the
committed regressed bank and watching it fail.

### Every guessing heuristic is now scored in standard errors, not percent

Three of the four holes the v2.8.0 review lanes found in `audit-bank.mjs` were
the same hole: **a threshold written as a literal, calibrated on conditions that
had since changed.** Every band in the script assumed four options and a
hundred-question file. Five of the eight banks now offer five options, and the
GMAT banks went from 30 questions to 90.

What that cost, measured rather than guessed:

- The slot band was `[14, 36]` at n>=100 and `[10, 42]` below it. The GMAT banks
  tripled and stayed in the wide bucket, where a slot holding 42% of the keys at
  n=90 is **more than five standard errors from chance** and still passed.
- On a five-option bank those same literals mean 1.7x and 2.1x chance, not the
  1.44x and 1.68x they were chosen to mean. The printed labels said "chance is
  25%" over numbers where chance was 20%.
- The two numeric-extreme caps and the middle-two cap were asserted **on the ALL
  row only**, so their spare headroom grew with the bank rather than with the
  evidence: 31 hits to 44, and 26 to 43, at an unchanged percentage. NMAT
  Logical Reasoning could go to 100% middle-keyed and the ALL row would still
  pass.

Every one of them is now `|share - chance|` divided by the standard error of
that share, per bank, with the chance rate derived from the bank's own modal
option count. **The threshold is 3 SE to fail and 2 SE to print a watch line.**
Three is about one false alarm in 370 checks and a run makes about sixty, which
is the point: a green build has to mean green, or the next author learns to
shrug at this script.

**The watch list is the half that will matter later.** It prints anything past
2 SE without failing, so a drift is visible one release before it breaks the
build, and nobody has to re-derive it by hand. Both of this project's real
biases were found by a person measuring something the script did not print.

Two entries sit on it today and are known, not overlooked: `gmat/quantitative`
keys the smallest numeric option 9.3% of the time against 20% by chance
(-2.3 SE), and `logical-reasoning` keys the largest 4.3% of the time (-2.3 SE).
Both are the mirror-image tell — "never pick the smallest" is a free
elimination — and both were left rather than fixed, because moving them means
changing distractor VALUES, and every distractor in that bank had just been
verified as reachable by a named arithmetic mistake. **A weaker distractor is a
worse question than a worse statistic.**

### The check that was structurally unable to see the bias it was built for

The longest-option check asks "is the key THE longest option". GMAT Verbal
passed it at 26.2% against 20% by chance while a candidate guessing between the
**two** longest scored 58.0% against 40% (+3.1 SE). One rank down was invisible.

It passed because two opposite artifacts cancelled inside one file. The 60
newly written questions keyed the longest option 40.7% of the time, the classic
long-hedged-key-beside-short-dismissive-distractors shape. The 30 that had a
fifth option retrofitted keyed it **0%** of the time, because the added
distractor was usually the longest string in the question. A file average hid
both, and either one alone would have failed.

`audit:bank` now measures the top-two length rank as well, skipping questions
where the second and third longest options tie, because there is no "top two"
for a candidate to see there.

Two rules fall out of this for any future bank-wide mechanical pass:
1. **Snapshot `id -> options[correctIndex]` before, compare after.** Both
   re-slot passes did, which is the only reason "no answer key moved" is a fact
   here rather than a hope.
2. **Re-measure EVERY statistic afterwards, not just the one you set out to
   move.** The pass fixed its target metric and broke a neighboring one, and
   both were already in the audit.
3. **Prove no key moved, and say what "moved" means.** The v2.8.0 retrofit
   touched **82** pre-existing questions (the other 8 already carried five
   options), and a review lane found the PR body's "byte-identical keys" claim
   was false: six Data Sufficiency keys were re-cased by the canonical-set
   normalization the new audit invariant forces. No answer moved, but the
   correct claim is "semantically identical, six re-cased", and the looser one
   would have hidden a real edit if there had been one.

Data Sufficiency remains in **canonical A-E statement order** (PR #7's bank-wide
option shuffle had scrambled all 11, which trains the wrong habit, since real DS
uses a fixed memorized order). `gd-004` was re-keyed from A to E in v2.3.0.

**If you add Critical Reasoning, Reading Comprehension, Para Forming, or any
numeric question, run the audit.** The natural way to write a CR question is a
long, carefully-hedged correct answer beside three short dismissive distractors,
which is exactly how the 94.7% happened.

### Three wrong answer keys, found in v2.3.0

All three were in `data/questions/gmat/data-insights.json`, and in all three the
**explanation already contained the correct reasoning while `correctIndex`
disagreed with it.** That disagreement is the signature to grep for:

- `gd-004` keyed "statement (1) alone is sufficient" on the false claim that 11
  is the only prime between 10 and 14. 13 is also prime, and also odd, so the
  statements are insufficient even together. Re-keyed to E. The range was
  deliberately not narrowed to rescue the old answer, because "two values fit,
  so it is not sufficient" is the better Data Sufficiency lesson.
- `gd-005` keyed 20 dollars, the notebook subtotal, not the 32 dollar total.
- `gd-016` keyed 50 dollars, the hourly rate, where the question asks for the
  40 dollar fixed fee.

`gq-029` separately offered `6/36` and `1/6` as two different options. They are
the same number, so a student who double-counted (4,4) found their wrong answer
listed twice.

**A trap for whoever edits the bank next, which cost real time here:** writing an
edit script through a shell heredoc can collapse a doubled backslash, after which
JSON reads the survivor as an escape and every LaTeX times-operator becomes a
literal TAB followed by "imes". Eight spans were corrupted this way mid-pass. The
`$` delimiters stay balanced and **KaTeX still parses the result happily**, since
"imes" is just variables, so only the raw control-character check caught it.
Write bank edits from a real script file, never a heredoc.

### Open items (originally logged in PR #13; struck-through ones are since closed)

1. ~~The whole 300-question bank ships to the client on every page.~~ **CLOSED in v2.0.0** by per-section dynamic imports in `lib/question-bank.ts`, plus persisting the score as `StoredProgress.summary` so the breakdown never needs the bank.
2. ~~The correct option is systematically the longest; Data Sufficiency lost canonical order; Para Forming always opens with P or Q.~~ **CLOSED in PR #14 (v1.12.0)** — see the Answer-key statistics table above for the before/after numbers.
3. ~~**Six specific question defects**: `ls-055`, `lr-072`, `ls-063`, `ls-101`, `ls-045`, `qs-030`.~~ **CLOSED in v2.3.0.** All six were re-checked against the files on disk and **all six had already been fixed** by earlier passes without this list being updated. `lr-072` no longer offers an "opposite" option and its puzzle was brute-forced as uniquely solvable; `ls-055` has exactly one part-to-whole match; `ls-063`'s explanation says a cobbler *works on* shoes; `ls-101` is now a vocabulary item that does not contain the phrase; `ls-045` and `qs-030` were verified correct. **The lesson is about the list, not the questions:** a stale to-do that reads as an open defect costs the next reader an investigation each time. Re-verify before re-reporting.
   The v2.3.0 audit did find three genuinely wrong keys, all in GMAT Data Insights — see "Three wrong answer keys" above.
4. ~~`ProgressTracker` cells are 28px.~~ **CLOSED in v2.3.0** — 36px, with the sidebar widened `w-56` to `w-72` to fit (6 x 36px + 5 x 6px gaps = 246px inside a 254px content box). Still under the app's 44px floor, and deliberately: 36 cells at 44px do not fit any column width this layout can give them, and 36px clears WCAG 2.5.8 comfortably.
6. ~~**`audit:bank` has no PER-TOPIC length band.**~~ **CLOSED in v2.8.2.**
   The slot check had learned this lesson already and the length checks had not:
   a per-bank average hides a loaded topic, which is how Para Forming came to
   key the last option 8 times in 10 while every file-level number looked
   healthy. Measured when the band was added, **GRE Verbal Reading Comprehension
   keyed the SHORTEST option 14 of 30 times, 46.7% against 20% by chance,
   +3.7 SE**, inside a bank that read 20.0% overall and passed comfortably. It
   was the only failure across all eight banks.

   **The tension that made this look hard turned out to be measurable rather
   than a matter of taste.** The worry was that a must-be-true or primary-purpose
   key is NATURALLY the most minimal claim in its set, so a band would fail
   honest questions. Two things settled it. First, at a floor of eight questions
   per topic, Critical Reasoning: Inference does not even qualify, so the topic
   that prompted the worry is not judged at all. Second, "naturally shortest"
   does not help the candidate who has noticed: a reason for a tell is not a
   defense of it.

   The floor is **eight**, not the slot check's four. A slot check has five
   buckets and a lopsided split shows early; a length check has one bucket
   against a 20% expectation, where 3 of 8 is already 1.4 SE and means nothing.

   **That floor was also a hole, and a review lane proved it by exploiting it.**
   This bank names topics at two levels, so "Critical Reasoning: Weaken" and
   "Critical Reasoning: Assumption" are separate strings. Splitting a topic
   finely enough makes any bias inside it invisible to a per-topic check: the
   lane relabelled the 30 biased GRE Reading Comprehension questions into six
   sub-topics and the same +3.7 SE breach vanished, with not even a watch line.
   It was not hypothetical. NMAT Logical Reasoning's Critical Reasoning family
   is 19 questions across four sub-topics, none reaching eight alone, so the
   whole family was unjudged -- and Critical Reasoning is the topic this project
   records hitting 94.7% on the longest-option heuristic. Every sub-topic is now
   measured BOTH alone and rolled up to its family.

   **Only the two extreme ranks were measured, so a habit one rank in passed
   clean.** A bank keying rank 0 in 8 of 36 and rank 1 in 14 has its extremes at
   chance, and the audit exited 0 while "guess between the two shortest" scored
   61% against 40%. There was a bank-level two-longest band and no mirror.
   There is now a per-topic two-shortest band as well.

   **MARGIN IS DELIBERATELY UNMEASURED, and it is the honest limit of all of
   this.** A key one character shorter than the runner-up counts the same as one
   twenty-four characters shorter, though only the second is a tell anyone can
   see. So a future author can clear a failure by adding a character to enough
   keys and the audit will bless it. Read the margins before acting on a
   failure. A minimum-margin rule was considered and refused, because it adds a
   second threshold to argue about and the count-based rule is what the slot and
   longest-option checks already use.

   **The fix restated the KEY, and did not trim distractors.** Cutting a
   distractor below the key buys the statistic by making the question worse, and
   this repo had already settled that trade the other way. It also happened to
   move both statistics the same direction, since GRE RC's key-is-longest rate
   was 15.6%, BELOW its own chance rate. Only the six items whose margin a
   candidate could see were touched; the other eight sat within 7% of the next
   shortest option, which is invisible. GRE RC now reads 8 of 30, +0.9 SE.

5. `ConfirmDialog` styles the confirming action as a red outline and the cancel as solid green. A reviewer called this inverted; it is a **documented deliberate choice** from an earlier PR (green = keeps your work). Left alone pending a decision.


## THE ACCOUNTS BACKEND (v2.1.0, PR #18)

There is a database now. Accounts are **backend-only**: no sign-in UI exists, no
route requires a session, and anonymous practice is untouched. That is deliberate,
and it is the invariant to protect. `app/page.tsx` promises "no account needed" in
several places, so **the site must stay fully usable logged out** and no route may
redirect to sign-in.

### The files

| Path | What it is |
| --- | --- |
| `lib/db/index.ts` | Drizzle handle, `import "server-only"`. Uses the POOLED `DATABASE_URL`. |
| `lib/db/schema.ts` | better-auth's four tables (`user`, `session`, `account`, `verification`) plus two of ours (`security_event`, `rate_limit`). **Both of ours are created but wired to nothing yet** — nothing writes a security event and nothing reads a rate-limit row. Do not assume the audit trail is recording anything. |
| `lib/auth/server.ts` | The better-auth config. Read the `satisfies` note below before editing it. |
| `drizzle/` | Generated migrations, **committed on purpose** so schema changes are reviewable in a PR. |
| `drizzle.config.ts` | Migration tooling. Prefers the UNPOOLED URL but **falls back to the pooled one if it is unset**, which produces exactly the intermittent failures the comment in that file warns about. It also loads `.env.local` explicitly, because drizzle-kit runs as a plain Node process and does not inherit Next's env loading. |
| `app/api/auth/[...all]/route.ts` | `force-dynamic`. The only dynamic route in the build. |

Scripts: `npm run db:generate` (write a migration from the schema), `db:migrate`
(apply it), `db:studio`.

**Migrations are applied BY HAND, from a developer machine.** `build` is a bare
`next build` and there is no `vercel.json`, so nothing runs them on deploy. Do not
assume Vercel does it: merging a PR that adds a migration changes the schema in the
repo and NOTHING in the database, and the two silently diverge until someone runs
`db:migrate`. There is currently exactly one database and it is production; there is
no staging copy and no backup story written down. Read the generated SQL before
applying it.

### THE TRAP THAT WILL BITE YOU: dead config options

`betterAuth` is declared `<Options extends BetterAuthOptions>(options: Options & {})`.
That inference plus the `& {}` makes excess-property checking **unreliable**, not
absent, which is worse. Measured: a small options literal DOES get flagged, but once
the object grew to its real shape (adapter plus a hook function) TypeScript went
silent and **two invented options compiled clean, shipped, and did nothing**, each
with a confident comment claiming a protection that was never configured:

- `emailAndPassword.revokeOtherSessionsOnPasswordChange` — **zero occurrences in
  better-auth 1.7.1.** Made up. The real option is `revokeSessionsOnPasswordReset`,
  and it covers the RESET flow only. A signed-in user changing their password has no
  option at all: `/change-password` takes `revokeOtherSessions` in the request body,
  defaulting to false, so the UI must pass it explicitly or a password change will
  not evict an attacker holding a stolen session.
- `trustedOrigins` nested under `advanced` — `advanced` has no such key, so it was
  discarded and the effective list silently fell back to the `baseURL` origin.

**The options object is therefore assigned with `satisfies BetterAuthOptions` before
it reaches `betterAuth`. Keep it that way.** If you add an option and the build
fails there, the option is wrong; do not cast to make it pass. This is the same
failure this repo already recorded once, where UI copy "claimed a section lock that
did not exist for months."

### Other traps, each one already hit

- **`account.issuer` is required by better-auth 1.7.** It scopes account identity
  (`local:credential`, `local:oauth:<provider>`) and carries a unique index on
  `(issuer, accountId)`. A schema written from a pre-1.7 example 500s on sign-up with
  an empty response body. **Do not hand-write these tables from memory.** Print the
  authoritative shape instead:

  ```bash
  node --input-type=module -e "import {getAuthTables} from 'better-auth/db'; console.log(JSON.stringify(getAuthTables({emailAndPassword:{enabled:true}}),null,1))"
  ```

- **`neon-http` cannot open a transaction** (it throws `No transactions support in
  neon-http driver`). better-auth never attempts one: in **`@better-auth/drizzle-adapter`**
  (a separate package that `better-auth/adapters/drizzle` merely re-exports, so
  grepping inside `better-auth` for this finds nothing) every `db.transaction()`
  call site is MySQL-gated, and the adapter-level one is behind
  `config.transaction ?? false`. **But setting `transaction: true` on
  `drizzleAdapter` would turn every sign-up into an unhandled 500.**
- **Sign-up is therefore not atomic.** `createUser` and `linkAccount` are separate
  writes. A failure between them leaves a `user` row with no credential account that
  can neither sign in, nor re-register (the address is already claimed), nor reset
  (no email). Narrow trigger, unrecoverable outcome. The fix belongs with the sign-up
  route: either a self-healing path, or the WebSocket `Pool` driver, which conflicts
  with the pooled-connection rationale in `lib/db/index.ts`. It is a design decision,
  not a chore.
- **`baseURL` is NOT `SITE_URL`.** `SITE_URL` deliberately resolves to the production
  host even on a preview, which is correct for canonical tags and wrong for auth,
  because trusted origins derive from `baseURL`. `authBaseURL()` prefers `VERCEL_URL`
  on preview. Keep the two concepts separate.
- **`rate_limit` is OURS and is wired to nothing.** It is NOT better-auth's
  `rateLimit` model (`{ key, count, lastRequest }`) and is not registered with the
  adapter, so setting `rateLimit.storage: "database"` will NOT pick it up. The
  library's default is in-memory, which on Vercel is per-instance and dies with every
  cold start. **Treat cross-instance rate limiting as absent, not merely weak.**
- **The module-scope throw on a missing env var is deliberate.** It fails
  `next build`. That looks like a flaw and is not: Vercel deploys are atomic, so a
  failed build blocks the deploy while the previous deployment keeps serving. This
  happened for real — the first preview deploy died on a missing
  `BETTER_AUTH_SECRET` and production never noticed.

### Database-enforced invariants (three, each verified by direct INSERT)

The schema's philosophy is that anything the application must never do should be
impossible rather than merely unwritten. Each of these was tested by inserting a
violating row straight into Postgres, bypassing the app entirely:

1. `user_email_lower_unique` indexes `lower(email)`, not `email`. A plain unique index
   is case-SENSITIVE and would hold `Elijah@example.com` and `elijah@example.com` as
   two separate accounts.
2. `account_issuer_accountId_unique` covers the pair, because `accountId` is only
   unique within the issuer that minted it.
3. `session_no_raw_ip` is a CHECK that `ipAddress IS NULL`. `lib/auth/server.ts`
   strips the value in a create hook, but a hook is a behavior that lapses silently
   the day someone edits the file. **Raw IPs are never stored**: under the Data
   Privacy Act an address tied to an account is personal information. `logger.level`
   is `warn` for the same reason, because at `info` better-auth writes submitted email
   addresses into platform logs.

Also note `user_email_idx`: sign-in queries `where email = $1` on the bare column,
which the `lower(email)` expression index cannot serve, so without it every
authentication attempt is a sequential scan.

### Secrets and environments

- `BETTER_AUTH_SECRET` is set in Vercel for **Production and Preview only**, as
  Sensitive, with **different values per environment** so a preview leak cannot forge
  production sessions. Development is intentionally absent (Vercel rejects
  `--sensitive` there); local dev reads `.env.local`.
- `DATABASE_URL` (pooled, for the app) and `DATABASE_URL_UNPOOLED` (migrations only)
  come from the Neon integration. **Never paste a connection string into chat.**
- **`vercel env pull` gives you the PRODUCTION database.** v2.1.0 was developed and
  tested against it because that is what existed; it was empty throughout and cleaned
  up afterward. **Create a Neon development branch before the next database PR** so
  migrations stop landing on production.

### Known-open security items

Documented rather than fixed, in rough priority order:

1. ~~**No rate limiting that survives a cold start.**~~ **MITIGATED, not solved, in
   v2.3.0.** The account endpoints now 404 unless `AUTH_ROUTES_ENABLED=1`, which is
   what actually protects the database today, and explicit `rateLimit` rules were
   added (3 sign-ups/hour, 10 sign-ins/5min) in place of the library's uniform
   100-per-10s. **The storage is still per-instance memory and dies on every cold
   start, so cross-instance rate limiting remains ABSENT.** Turning the routes on
   without solving that re-opens the original hole.
   Why it mattered more than it looked: with no sign-in UI and no users, the risk
   was never account compromise. It was that `/api/auth/sign-up/email` was an
   anonymous unmetered write into the ONLY database, which is production, has no
   staging copy and no backup — and enough Vercel invocations make the Hobby plan
   pause the whole project, taking the exam site down with it. better-auth's origin
   check only fires on cookie-bearing requests, so a scripted POST is never
   origin-checked at all.
2. The orphaned-user window described above.
3. ~~**No CSP or security headers yet.**~~ **CLOSED in v2.3.0.** `next.config.ts` was
   an empty object; it now sets CSP, HSTS (production only, deliberately without
   `preload`), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and
   `Permissions-Policy`, and drops the `X-Powered-By` banner. `frame-ancestors 'none'`
   is therefore in place BEFORE the first sign-in form exists, which was the point.
   **`script-src` keeps `'unsafe-inline'` and this is a measured decision, not an
   oversight** — Next serializes each page's React Flight payload into inline scripts
   whose contents change every build, so hashes are unmaintainable, and a nonce needs
   middleware, which would force every page out of static prerendering and break the
   one-dynamic-route invariant. Under CSP2+ any hash or nonce silently VOIDS
   `'unsafe-inline'`, so the two cannot be combined as a fallback. When the sign-in UI
   ships, add a `middleware.ts` matched to the auth routes only and give those
   responses a nonce plus `'strict-dynamic'`; they must be uncacheable anyway, so the
   static pages keep their prerender.
4. 30-day sliding sessions with no UI to revoke them. The endpoints already exist
   behind the catch-all route; only the interface is missing. Ship the session list
   with the first auth UI, or shorten `expiresIn` to 7 days until it exists.
5. A residual ~40ms timing difference on sign-in between a known and unknown address.
   This is the extra Neon round trip, **not** a missing dummy hash — better-auth
   already equalizes the scrypt cost. No config setting fixes it.

### If you build the sign-up UI next

`autoSignIn` is **off**, which is what closes user enumeration: better-auth returns a
synthetic success for an already-registered address, but only when
`requireEmailVerification` is on or `autoSignIn` is off, and verification needs email
this project does not have. Two consequences for the UI:

- Sign-up does **not** return a session. Sign in explicitly afterward.
- A returning user gets the same response as a new one, so the copy must be
  non-committal: "Account created. If this address was already registered, sign in
  with your existing password." Claiming a new account was created would be a lie
  half the time.

## Lesson learned: never run multiple agents against the same data file concurrently

During PR #7, three background content-editing agents were dispatched in parallel, all targeting `data/questions/language-skills.json` (different topics: Para Forming, Sentence Completion, Reading Comprehension/Vocabulary). They collided — each did a full-file read-modify-write, and whichever wrote last silently clobbered the others' work (and my own direct edits made in between). This wasn't caught by any agent's self-report; only independent verification (re-reading the file fresh and checking against expected state) caught it. Recovery required resuming each agent serially (one at a time, waiting for full completion + verification before starting the next) rather than trying to merge divergent edits.

**The rule held up in v2.3.0, and the shape of what happened is worth recording.** Four content agents ran in parallel against four DIFFERENT bank files, which is allowed and worked. Two things still came out of it:

- One agent noticed edits in its file that were not its own (mine, made before it started) and correctly flagged them as a possible concurrent-write collision rather than silently overwriting them. Its full read-modify-write preserved them. **That flag is the behavior you want** — but note it could not tell "an edit made before I started" from "an edit made while I was running", and neither can you after the fact. Only the ordering saved it.
- An agent reported success on work that was silently corrupted: a shell heredoc collapsed a doubled backslash and turned every LaTeX times-operator into a literal TAB. Its own verification passed, because the `$` delimiters stayed balanced and KaTeX parses the wreckage happily. **A second agent's warning and an independent mechanical check caught it, not the agent's self-report.** Never treat an agent's "verified, all checks pass" as verification of anything the checks do not actually cover.

**Rule going forward: never dispatch more than one agent with write access to the same file at the same time.** If multiple content edits are needed on one file, either do them yourself sequentially, or dispatch agents one at a time and verify each one's result against the actual current file state before starting the next. This is the same class of near-miss documented elsewhere in this file (the `git mv` question-bank-relocation near-miss) — concurrent writers to shared state in this repo have bitten this project twice now.

**Branches: `main` is the only one, local and remote, as of v2.3.0.** All 19
merged feature branches were deleted at the user's request after PR #21.

This paragraph used to name six of them as "not cleaned up, left for the user to
decide". By the time anyone acted on it there were **nineteen** — the list had
been written at PR #6 and never revisited while PRs #7 through #21 piled up.
That is the third stale-note defect this document has produced (see also the six
"open" question defects that had all been fixed, and the MobileNavSheet focus
trap recorded as fixed when it never was), so the note now states an invariant
rather than an inventory.

**If you need to check merged-ness before deleting a branch, `git branch
--merged main` is the wrong tool here.** This project squash-merges, so a
merged branch's tip is never an ancestor of `main` and every branch looks
unmerged. Ask GitHub instead:

```bash
gh pr list --state merged --limit 100 --json headRefName -q '.[].headRefName' | sort -u
```

Then confirm each local branch is in sync with its remote (so nothing unpushed
is lost) and record the tip SHAs before deleting — `git branch <name> <sha>`
restores any of them, and GitHub retains merged PR refs regardless.

## Open loop status

The PDF-answer-key review loop mentioned in earlier versions of this doc is **closed** — the user came back with a feedback batch (pause screen copy, transitions, PQRS predictability, topic bunching, RC overload, weak distractors, a specific modifier-question bug, progress-grid coloring) and all of it shipped in PR #7 (v1.5.0), see above. No PDF-review open loop remains as of this writing.

If asked to regenerate the answer-key PDF in the future: one-off Node script (`data/questions/*.json` → self-contained HTML using local KaTeX assets from `node_modules/katex` → headless Chrome `--print-to-pdf`, no new npm dependencies needed). Pattern: build HTML with `renderMathInElement` from `node_modules/katex/dist/contrib/auto-render.min.js`, then `"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf=<out>.pdf <file>.html`. Not committed to the repo (it's a report generator, not app code).

## Verifying UI work in a browser (two traps that produce confident wrong answers)

There is no browser MCP wired into this repo. The v2.3.0 pass drove real
headless Chrome over the DevTools Protocol with a ~60-line zero-dependency
driver (Node's global `WebSocket` plus `/json/list`), which is worth rebuilding
rather than trusting inspection. Two mistakes were made and corrected while
doing it, and both LOOK right:

1. **`element.focus()` from script does not make `:focus-visible` match.**
   Chrome gates that pseudo-class on interaction heuristics, so
   `getComputedStyle(el).outlineColor` silently falls back to the element's own
   `currentColor`. This produced a confident "5.30:1 PASS" on a white-text
   button and an equally confident "1.00:1 FAIL" on a green-text one, neither of
   which measured a focus ring at all. Dispatch a real `Tab` via
   `Input.dispatchKeyEvent` and assert `el.matches(':focus-visible')` before
   measuring anything.
2. **These colors resolve as `oklab(...)`, because the theme derives them with
   `color-mix`.** Scraping numbers out of that string strips the minus signs and
   then treats oklab components as if they were 0-255 sRGB. Let the browser
   resolve them: paint into a 1x1 canvas over the page background and read the
   pixel back, which also composites translucent surfaces to what the eye sees.

Also worth knowing: `npm run start` fails with `EADDRINUSE` if a previous server
is still bound, and **the old server keeps answering**, so screenshots silently
show a stale build. On Windows, `pkill -f next-server` does not work; find the
PID with `netstat -ano | grep :3000` and `taskkill //PID <pid> //F`. A "fix"
that appears not to have applied is usually this.

## Environment quirks worth knowing

- **Windows + Git Bash.** The Bash tool runs Git Bash (POSIX sh), not cmd/PowerShell. A separate PowerShell tool is also available.
- **`gh` CLI is installed but not on the Bash tool's default PATH** — every `gh`-using Bash command needs `export PATH="$PATH:/c/Program Files/GitHub CLI"` prefixed (shell state doesn't persist across separate Bash tool calls).
- Chrome and Edge are both installed at their standard paths (`C:\Program Files\Google\Chrome\Application\chrome.exe`, `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) — useful for headless PDF generation or other browser-CLI needs; no `pandoc`/`wkhtmltopdf` installed.
- `pdftoppm`/poppler-utils are NOT installed, so the `Read` tool cannot render PDF pages to images in this environment — can't visually self-check generated PDFs that way; verify via the source HTML in a real browser (chrome-devtools MCP) instead, since the PDF is a print of that HTML.
- A `chrome-devtools` MCP integration is available and was used throughout for live browser verification (screenshots, DOM/script evaluation, viewport resizing) — use it to actually verify UI changes rather than assuming from code alone, per the project's "test the golden path in a browser" expectation.
- **`vercel` CLI** is available via `npx vercel` and the project is linked (`elijahtuyays-projects/reviewer-website`). Useful read-only commands: `npx vercel ls` (deployment status, which is how a failed build gets caught), `npx vercel inspect --logs <url>` (build logs), `npx vercel env ls` (names only, never values). Adding a secret without it ever touching disk or the transcript: pipe it, e.g. `node -e "..." | npx vercel env add NAME production --sensitive`. Note `--sensitive` is rejected for the Development environment.
- **The permission classifier blocks some outward-facing commands**, including `npx vercel redeploy` and certain shell patterns that assign a secret to a variable. Do not work around it; push a commit and let the deploy happen naturally, or ask the user.
- **Long heredocs containing mixed quotes fail in this Bash tool.** Writing a file with the Write tool and splicing it in with a short Python step is the reliable pattern.
- Dev server: `npm run dev` (Turbopack), typically on `http://localhost:3000`. Build: `npm run build`. Lint: `npm run lint` (must pass with zero errors before every merge, per team-workflow discipline even though it's not written as an explicit CLAUDE.md rule).

## User preferences (persisted in this agent's cross-session memory, but restated here in case a fresh agent has no memory access)

- **Always post the live `http://localhost:3000` link when returning to chat after finishing a task** — the user wants a one-click way to check results without asking. Make sure the dev server is actually running before posting the link.
- The user has, in past sessions, granted broad time-boxed autonomy ("auto-approve everything until 6AM," later extended to 12 noon) — but that authorization is time-boxed and conversation-specific, not a standing grant. A new session should NOT assume blanket autonomy; check current conversation context for explicit authorization before taking risky/irreversible actions.
- The user reacts well to autonomous, thorough work (multi-agent research/review dispatches, self-caught bugs, live browser verification) but has corrected scope creep before (e.g. "one PR per batch, not one per item"; "don't go for anything too fancy" on design). Default to disciplined, scoped execution over speculative expansion.

---

**Current state: `main` is at v2.8.0, and is the only branch.**

"Clean" is five commands rather than a claim, and all five pass on `main`:

```bash
npx tsc --noEmit        # zero errors
npm run lint            # zero errors, zero warnings
npm run verify:engine   # adaptive ladder, both scoring models, the calculator
npm run audit:bank      # every statistical guarantee about the question bank
npm run audit:copy      # ASD-STE100 compliance of every user-facing description
```

`npm run build` must also still print exactly ONE dynamic route
(`ƒ /api/auth/[...all]`), with every page `○ (Static)` or `● (SSG)`. That
invariant is load-bearing: it is what keeps the site free to host and what the
CSP decision in `next.config.ts` depends on.

This line has been wrong before — it read v2.2.0 while `main` was at v2.3.0 —
so if the version above disagrees with `VERSION.txt`, trust `VERSION.txt`.
