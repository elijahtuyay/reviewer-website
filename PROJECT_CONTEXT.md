# Project Context — NMAT Reviewer

**Read this file fully before doing anything.** It's a handoff document written for a brand-new Claude Code session with zero memory of prior work on this repo. Last updated: 2026-08-21, at PR #15 / VERSION.txt `2.0.0`.

## What this project is

An exam-prep web app for **NMAT by GMAC** (a Philippine business-school admission test), built with Next.js 16.3.0 (Turbopack), React 19, TypeScript, and Tailwind v4. A second exam, **GMAT**, is architecturally scaffolded but has zero question content yet (deliberate — see "Multi-exam architecture" below). The repo lives at:

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

## Copyright rule (critical, applies to ALL future content work)

Three reference books exist at `C:\Users\elija\Downloads\nmat test files\` (with markdown conversions in its `md/` subfolder, plus the user's own GMAT notes as .txt files):
- NMAT Official Guide 2021
- Princeton Review GMAT Premium Prep
- GMAT for Dummies

These are **pirated/copyrighted** and may be used **strictly as calibration reference** — topic taxonomy, style, question difficulty, real-world proportions of question types. **NEVER copy or paraphrase their actual text, numbers, scenarios, or passages.** All question content in this repo must be original composition. The user's exact words: *"you may use them as reference, but style your questions to be as absolutely, humanly close and faithful to them as legally possible. those files are the holy grail of our accuracy."* Treat their reported facts/answers as ground truth to calibrate against, but never reproduce their prose.

## AGENTS.md warning — read before touching Next.js APIs

This Next.js version (16.3.0) has **breaking changes vs. typical training data**. Before writing any routing/data-fetching/API code, check `node_modules/next/dist/docs/` (resolved relative to repo root) for this version's actual conventions. This has mattered in practice — e.g. `notFound()` is documented as callable only from Server Components/Server Functions/Route Handlers, NOT Client Components (see "Known issue" below for how this was handled).

## Architecture

### Multi-exam design
- `data/schema.ts`: `ExamId = "nmat" | "gmat"`. `SectionId` is a loose `string` (not a fixed union) since each exam has different sections.
- `lib/exam-config.ts`: single source of truth. `EXAMS: Record<ExamId, ExamConfig>` registry with per-exam `theme` (accent color), `sections[]` (id/label/description/questionCount/minutes), `pointsPerCorrectAnswer`, and `available: boolean`. **`gmat.available === false`** — it has section configs but `questionCount: 0` for all of them, and the route layer 404s it (see below). NMAT accent green `#0f7b4d` is an *approximated* brand color (mba.com/exams/nmat was bot-protected during scraping attempts, so it's not pixel-verified — swap it if you ever get the exact hex).
- Routes: `app/[examId]/page.tsx` (exam setup/landing), `app/[examId]/quiz/[section]/page.tsx` (the actual quiz, client component). `app/[examId]/layout.tsx` (server) validates `examId` and applies the exam's theme via CSS custom properties on a `display: contents` wrapper (zero layout impact, properties still inherit). `app/[examId]/quiz/[section]/layout.tsx` (server, added later — see bug fix history) validates `examId` + `section` + `exam.available`, 404ing before the client page ever renders.
- Question banks: `lib/data/questions.ts` exports `QUESTIONS_BY_EXAM: Record<ExamId, Record<string, Question[]>>`. **The underlying JSON files stay at their original flat path** `data/questions/{language-skills,quantitative-skills,logical-reasoning}.json` — NOT moved into a `data/questions/nmat/` subfolder. This was a deliberate decision after a near-miss: an attempted `git mv` into a subfolder was caught and reverted while background content-fix agents were actively editing those exact files at the old path. There IS an empty, untracked `data/questions/gmat/` directory sitting on disk (harmless leftover, safe to ignore or delete).
- `lib/session-progress.ts` (was `lib/local-progress.ts` until v1.6.0): **sessionStorage**, keyed `progress:${examId}:${section}`. Every read/write path is wrapped in try/catch. The record holds `answers`, `submitted`, `questionIds`, `deadline` (epoch ms), `expired`, and `pausedAt`. sessionStorage is deliberate: an attempt survives reloads and moving between the setup page and a quiz, but dies with the tab/browser. `purgeLegacyPersistedProgress()` clears the old, permanently-lingering localStorage `progress:*` keys from pre-1.6.0 builds. Also exports `clearSectionProgress` / `clearExamProgress` for explicit restarts.
- `lib/scoring.ts`: `scoreAttempt(questions, answers, pointsPerCorrectAnswer)`.
- `lib/section-result.ts`: `getSectionBreakdown(examId, sectionId, fallbackTotal)` — powers the post-submit sidebar correct/wrong/skipped breakdown.

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
- Design philosophy: the user explicitly asked to model UI conventions on **first-world government websites (US/Canada/Singapore)** — USWDS, Canada.ca (GC Design System), Singapore's SGDS — researched live via WebSearch. Applied *principles* (restraint, accessibility, clear typographic hierarchy, minimal functional-only motion, visible focus states, 44px tap targets) rather than a visual reskin. Explicit user instruction: **"don't go for anything too fancy."** Do not redesign colors/spacing/typography wholesale without being asked again.
- Attempt state is **session-scoped and never resumed silently** (v1.6.0). The quiz shows a banner distinguishing resumed / already-submitted / expired attempts, each with a Retake action, and `components/SessionResetNotice.tsx` on the section-select page warns that progress is cleared when the tab closes, lists sections holding saved work, and offers "Clear saved progress". If you touch this area, keep the invariant: **any state restored from a previous visit must be stated in the UI.**
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
10. Two pre-existing lint false-positives were cleaned up (`ThemeToggle`'s `react-hooks/set-state-in-effect`, `ThemeInitScript`'s `@next/next/no-before-interactive-script-outside-document` — both are legitimate patterns the lint rules don't account for; each has an inline `eslint-disable` comment explaining why).

## PR/version history (what shipped, in order)

- `e824c05` (v1.0.1) — established the semver + branch/PR workflow itself.
- `c1fc6be`/`643e08e` (v1.1.0) — UI redesign: theme system, sidebar nav, resumable sessions.
- `2822aa7`/`9ec622c` (v1.2.0) — expanded question bank to 300 (100/section), random-36-draw-per-attempt.
- **PR #4**, `305160c` (v1.3.0) — the big `reminders.txt` batch: multi-exam architecture, KaTeX math rendering, sticky header, pause overlay, page transitions, brand accent color, full content overhaul (topic ratios, difficulty, em-dash removal) across all 300 questions.
- **PR #5**, `2b26e9a` (v1.4.0) — post-merge autonomous audit (5 background agents: 3 design-system research, 2 bug hunts) + fixes: timer drift, localStorage write crash, mobile nav, tap targets, focus rings, lint cleanup.
- **PR #6**, `f0e6707` (v1.4.1) — follow-up fix: color-only correctness indicator.
- **PR #7**, `d3479a6` (v1.5.0) — response to user's post-PDF-review feedback batch. Fixed a severe pre-existing bug found while investigating (not explicitly reported): the correct answer's option slot was heavily skewed toward A bank-wide (logical-reasoning was 86/119 correctIndex 0, several topics literally 100% "always A") — fixed with a mechanical options-array shuffle across all 300 questions. Also: Para Forming (10 questions) had the printed P/Q/R/S line order always exactly matching the correct sequence, plus telltale concluding adverbs marking the last sentence — both fixed. Sentence Completion (12 questions) had distractor sets that were 3 near-synonyms vs. 1 obvious answer — rewritten to be individually plausible. Reading Comprehension trimmed 26→18 (two whole passages retired), replaced with 8 new "Vocabulary in Context" questions. Topic-bunching fixed via a display-order interleave (`interleaveByTopic` in `lib/data/questions.ts`, best-effort not a hard guarantee for topic-imbalanced draws). PauseOverlay copy simplified + crossfade transition added. ProgressTracker now stays visible after submission and color-codes cells green/red.

- **PR #9** (v1.6.0) — session lifecycle / error-handling fix. The user reported being confused by an old session that had "timed out". Two stacked defects: progress was written to `localStorage` with no expiry (so a half-finished or already-submitted attempt survived browser restarts forever), while the timer restarted at full length on every mount — pairing an old question set and old answers with a fresh clock, and dropping a resumed submitted attempt straight into review mode with no explanation. Fixed by moving progress to sessionStorage, persisting the timer deadline (plus `pausedAt`), and never resuming without saying so. See the sessionStorage/Timer/`SessionResetNotice` notes above.

- **PR #10** (v1.7.0) — LaTeX normalization + rendering/UX batch. Bank-wide conversion of raw-text math to LaTeX; `a/an` before blanks (ls-062 was leaking its answer outright, since only the correct option was vowel-initial after "an ___"); `ls-090` analogy rekeyed to "Investigator". Timer rebuilt around a boundary-aligned self-rescheduling timeout with `Math.ceil` (a drifting `setInterval` plus `Math.round` was visibly skipping seconds). Fractions fixed via `\displaystyle` in `MathText`. Saved-attempt rows made clickable; sections now scroll to the results on submit. Pre-existing bugs fixed: an earlier `$` → `₱` pass had eaten opening math delimiters at 8 sites; 8 circular-seating questions had a self-contradictory facing convention that left 3 of them unsolvable; 6 explanations still referenced pre-shuffle option letters, 2 of which called the correct answer wrong.
- **Review lanes are now mandatory per PR** (see CLAUDE.md): logic, syntax/display, UX, content correctness. Their first run (PR #10) found the unsolvable seating puzzles, the drifted explanations, and proved a CSS "fix" of mine was a measured 11% regression. Take their findings seriously and verify claims independently.

- **PR #13** (v1.11.0) — home landing page + audit fixes + hosting readiness. The home page was a bare gateway (hero, exam list, two placeholder cards); it is now a real landing page modelled on the structure of cseexamreviewer.com at the user's request: accent hero band, stat row, per-section cards, how-it-works, three alternating feature bands, a "more exams" block, a native `<details>` FAQ, a closing CTA, plus a new `SiteFooter` carrying the GMAC non-affiliation disclaimer. `SiteHeader`'s three inert "soon" chips became real exam links. Audit fixes shipped alongside: `body { font-family: Arial }` had been silently overriding the Geist webfont app-wide since the starter template; `--accent` failed WCAG as text in dark mode (3.11:1) so `--accent-text` was added, derived via `color-mix` so it tracks each exam's accent; PauseOverlay opened with focus on `<body>`; `handlePause`/`handleDeadlineChange` wrote render-closure `answers` to storage and could lose an answer to a same-frame race. Hosting groundwork: `generateStaticParams` + `dynamicParams = false` on both dynamic segments (every route is now build-time prerendered, zero on-demand server rendering), `metadataBase` + title template + per-exam `generateMetadata`, `robots.ts`, `sitemap.ts`, `not-found.tsx`, `error.tsx`, JSON-LD on the home page, and `lib/site.ts` holding `NEXT_PUBLIC_SITE_URL` and the disclaimer.

## Known non-issue: the answer-key distribution

A separate Claude session reported (2026-08-21) that the correct answer sits in slot 1 for 86% of Logical Reasoning questions and 49% overall, and that `ls-010`'s explanation was a copy-paste slip about "malevolent/vindictive/benevolent/altruistic". **Both were checked against the files on disk and both are false.** The measured distribution is 25.0 / 22.0 / 27.7 / 24.3 / 1.0 percent across indices 0-4 of all 300 questions (the 1% at index 4 is the 11 quantitative questions with five options), and `ls-010` carries a correct, on-topic explanation about sleep and memory consolidation. The word "malevolent" appears nowhere in the bank. The reported 86% figure is verbatim the pre-v1.5.0 bug that PR #7 already fixed, so that session was almost certainly reading a stale snapshot. Re-measure before acting on a claim like this:

```bash
python -c "import json,io,collections; c=collections.Counter(); [c.update([q['correctIndex']]) for n in ['language-skills','quantitative-skills','logical-reasoning'] for q in json.load(io.open(f'data/questions/{n}.json',encoding='utf-8'))]; print(c)"
```

## Hosting

**Deployed on Vercel (Hobby), as of v2.0.1.** Chosen over Cloudflare because Next.js is Vercel's own framework, so there is no adapter and no build configuration, and because API routes run natively there when the accounts backend arrives. The Hobby plan never bills (it pauses at the limit) but **forbids commercial use** — ads, payments or a paid plan mean upgrading or migrating to Cloudflare Workers, which is about a day's work since nothing depends on Vercel-specific APIs.

As of v1.10.0 the build emits no dynamic routes: `npm run build`'s route table should show only `○ (Static)` and `● (SSG)`. There is no database, no runtime secret, and no request-time work.

`SITE_URL` (`lib/site.ts`) resolves at build time from `NEXT_PUBLIC_SITE_URL`, then Vercel's automatic `VERCEL_PROJECT_PRODUCTION_URL`, then localhost. The middle step exists specifically so a deploy that forgets the first cannot silently publish a sitemap and a full set of canonicals pointing at `http://localhost:3000`. **Only set `NEXT_PUBLIC_SITE_URL` once a custom domain exists.** Every consumer of `SITE_URL` is a Server Component or metadata route; check that before importing it into anything marked `"use client"`, since the Vercel variable is not `NEXT_PUBLIC_` and would be undefined in a client bundle.

### Review-lane findings applied in the same PR

All four lanes ran. Beyond the items above they surfaced, and this PR fixes:

- **The section lock was never enforced.** The app has always told users a section locks you in until you submit ("just like the real exam") and SectionNav has always greyed out the other two, but the greying was cosmetic and every page linked straight to every quiz URL. Starting a second section left two clocks burning, the first silently bleeding out. `findActiveAttempt()` in `lib/section-result.ts` is now the real check: the quiz page renders a lock screen instead of drawing a set, and the home page's per-section CTA (`components/SectionStartButton.tsx`) reflects start/resume/review/blocked instead of always saying "Start". An expired-but-unsubmitted attempt deliberately does NOT block, or the user would be stranded; a paused one does.
- **`--accent-text` did not track the per-exam accent, and its comment claimed it did.** A custom property containing `var()` is substituted at the element that DECLARES it; declared on `:root` it is permanently bound to `:root`'s `--accent`. Fixed with a `.exam-theme` class carried by the per-exam wrapper that re-declares it. **If you add another accent-derived token, put it in both places.**
- **PauseOverlay rendered for 200ms on every quiz mount** (no first-mount guard on the exit effect), which the newly-added `aria-modal` turned into a phantom modal. Also now restores focus on resume and traps Tab.
- **Root-layout metadata was inherited by every child**: `canonical: "/"` and `og:url: "/"` on the root layout made every quiz page a declared duplicate of the home page, sharing one tab title.
- **`robots.txt` Disallow fought the `noindex`** — a blocked crawler never reads the tag. Disallow removed; `noindex` alone is stronger.
- RC prompts embed their passage; it is now split from the stem and rendered as a distinct block. The split boundary is `[.!?]"\s+(?=[A-Z])`, NOT the last quote (vocabulary stems quote the tested word) and NOT the first (passages contain quoted speech). Self-guarding: a stem not ending in `?`/`:` falls back to unsplit. 18/18 split, 282 non-passage prompts untouched.
- `interleaveByTopic` now prefers no two adjacent questions to share a topic (was: no more than two in a row). The old greedy largest-first pick meant every attempt opened with a matched pair. Measured over 400 draws per section: zero adjacent same-topic pairs.
- Scores now show `21 / 108` plus a percentage and an explicit "this is not an NMAT scaled score" note; progress-grid legend leads with colour; `/gmat` shows its mapped-out format instead of being a dead end; quiz header no longer truncates the h1 to "Langua…" at 390px; pause overlay shows the frozen clock.

- **PR #14** (v1.12.0) — question-bank statistical + correctness pass, closing the length-bias hole PR #7 left open. No app code changed. Details in "Answer-key statistics" below.

## THE MODULAR EXAM ARCHITECTURE (read this before adding anything)

As of v2.0.0 exams are drop-in modules. **`lib/exams/registry.ts` is the only file that lists exams.** To add one: write `lib/exams/<id>/index.ts` default-exporting an `ExamModule`, put its JSON under `data/questions/<id>/`, and add one line to that registry. Routes, home page, setup page, section lock, sitemap, footer and the quiz engine all read from it.

The contract is `lib/exams/types.ts`. The crucial idea is that an exam declares how it BEHAVES as data, so the engine never branches on an exam id:

- `rules.navigation` -- `"free"` (NMAT: whole section on a page, skip and revisit) or `"sequential"` (GMAT: one at a time, no going back). This picks the runner.
- `rules.allowSkip`, `rules.adaptive`, `rules.reviewEdit`, `rules.sectionOrder`, `rules.lockToOneSection`, `rules.optionalBreakMinutes`
- `scoring` -- `points` (NMAT, marks per correct) or `scaled` (GMAT, 205-805 weighted by difficulty with an unanswered penalty)

**If you are about to write `if (examId === "...")` outside `lib/exams/`, add a rule instead.** The exam setup page's "what to expect" bullets and the home page's per-exam highlights are both GENERATED from `rules`, which is deliberate: the old hand-written copy claimed a section lock that did not exist for months.

Files: `lib/exams/{types,registry}.ts`, `lib/exams/{nmat,gmat}/index.ts`, `lib/question-bank.ts` (lazy per-section loading), `lib/adaptive.ts`, `lib/scoring.ts`, `components/quiz/{useAttempt.ts,FreeFormRunner.tsx,SequentialRunner.tsx,shared.tsx}`, `app/[examId]/quiz/[section]/page.tsx` (a shell that picks a runner).

`useAttempt` holds ALL attempt state for every exam: storage, timing, pause, expiry, the section lock, adaptive serving, scoring, the review pass. Runners are presentation only.

### Question banks are now lazily loaded per section

`lib/question-bank.ts` dynamic-imports one section at a time and caches it. Previously every bank was statically imported into one module, so ~220 KB of questions sat on the critical path of the exam setup page and of every quiz section including the two you were not taking. `getSectionBreakdown` no longer touches the bank at all: the score is written into sessionStorage at submit time as `StoredProgress.summary`. Verified after the change: each section's bank is its own chunk and none is referenced by any route's client manifest.

**The sync/async split matters.** `loadSection()` is async and must be awaited once (the quiz page does it in an effect); `getLoadedSection()` is the synchronous cache read used during render.

**Strict Mode trap, already hit once:** the loader effect is deduped by a ref, so it must NOT cancel its own in-flight promise on cleanup. React double-invokes mount effects in dev as mount-cleanup-mount; cancelling killed the only run that was allowed to proceed and the quiz hung on a blank screen.

### GMAT specifics

GMAT Focus: Data Insights 20q, Quantitative 21q, Verbal 23q, 45 minutes each, 64 questions, 205-805. Verbal has NO sentence correction; Quantitative has NO geometry; Data Sufficiency belongs to **Data Insights**, not Quantitative. Bank is a **90-question seed** (30 per section, 10 per difficulty), not a finished bank: a perfect run exhausts the ten hard questions and falls back to medium.

`npm run verify:engine` asserts (and exits non-zero) on the adaptive ladder and both scoring models. It has already caught three real bugs: a perfect attempt scoring 810 on a band whose maximum is 805, difficulty weighting being a no-op, and timing out scoring higher than finishing. **Run it after touching `lib/adaptive.ts` or `lib/scoring.ts`.**

### Scoring traps that were live and are now asserted against

1. **The scaled denominator must be a FIXED reference**, not the weight of what was served. Normalising by served weight made `difficultyWeight` do nothing: any all-correct run scored 805, so sweeping easy questions beat a strong partial run on hard ones.
2. **`scoreAttempt` takes the section's real length.** Scoring only what was served made timing out after four questions score 675/805 while a genuine 50% run scored 505. Unreached questions count as unanswered.
3. **An expiry discovered on load must write a `summary`.** Writing `submitted: true` with `summary: null` made every screen outside the quiz report a real result as 0 correct. A submitted record without a summary is now treated as an unknown score and shown as a bare "Submitted".

### Other traps this architecture has already sprung

- **The review pass allowance is derived from a baseline snapshot, not counted per click.** Counting clicks made a misclick cost two of three changes.
- **`findActiveAttempt` and section totals must use `section.questionCount`,** never `stored.questionIds.length`: on a sequential exam the served list grows as you go, so a 20-question section read "4 of 5 answered".
- **`restart()` needs the same section-lock check the load path has.** Without it, Retake was a way to get two clocks running.
- **`MathText` applies `\displaystyle` only to spans containing a fraction.** Applying it to everything swelled superscripts so `$x^2$` rode into the line above.
- **Per-exam accents must be measured, not picked.** GMAT's first blue was 1.59:1 on the dark background, half of NMAT green's 3.11:1, which made the selected-option ring fainter than the neutral borders around it. `#2563eb` matches NMAT's profile.
- **Generated copy has to match the rules.** The break bullet claimed Pause implements the exam's timed break budget; nothing enforces one. If a rule has no engine behind it, say what the app actually does.

### Answer-key statistics (re-measure before trusting any claim about these)

The bank has now been hardened against three different "answer without reading" strategies. All three were measured, fixed, and re-measured:

| Strategy | Before | After | Chance |
| --- | --- | --- | --- |
| Always pick slot 1 | 25.0% (already fine since PR #7) | 25.3% | 25% |
| Pick the longest option (prose questions) | 47% overall; **94.7% on Critical Reasoning**, 75% on Reading Comprehension | **14.7%** overall, 0% on CR, 3.6% on RC | 25% |
| Para Forming: assume the answer starts with Q | 8 of 10 keys opened with Q, 0 with R or S | P3 / Q3 / R2 / S2 | even |
| Para Forming: pick the majority opening letter | never eliminated the key (10/10) | key is in the plurality 6/10 | mixed |

Data Sufficiency was also restored to **canonical A-E statement order** (PR #7's bank-wide option shuffle had scrambled all 11, which trains the wrong habit since real DS uses a fixed memorised order), and rebalanced from "both together" being correct 5 of 11 times to 2/2/3/2/2 across A-E. Two questions were rewritten to achieve that: `qs-036` now hinges on the $(l+w)^2$ identity so statement (1) alone suffices, and `qs-095` is now genuinely insufficient even combined.

**If you add Critical Reasoning, Reading Comprehension, or Para Forming questions, check these numbers again.** The natural way to write a CR question is a long, carefully-hedged correct answer next to three short dismissive distractors, which is exactly how the 94.7% happened.

### Open, deliberately not done in PR #13

1. **The whole 300-question bank ships to the client on every page** (~220 KB), on `/[examId]` as well as every quiz section. Fix means making the bank load per-section, which means `lib/section-result.ts` and its render-time callers go async, or the per-section score is persisted at submit so the breakdown never needs the bank. Own PR.
2. **Content: the correct option is systematically the longest.** Pick-longest scores **56.9%** on prose-option Logical Reasoning and **50.3%** on Language Skills, against a 25% baseline — a bigger hole than the positional skew PR #7 closed. Also: the 11 Data Sufficiency items were shuffled out of canonical statement order by that same pass (real DS uses a fixed memorized order), "both statements together" is correct 5 of 11 times, and all 10 Para Forming items open with Q or P, never R or S.
3. **Six specific question defects**: `ls-055` (two defensible answers), `lr-072` (offers "opposite A" in a five-seat circle), `ls-063` (explanation says a cobbler *makes* shoes), `ls-101` ("abundant with" is not idiomatic), `ls-045`, `qs-030`. Zero wrong keyed answers across all 300.
4. `ProgressTracker` cells are 28px, under the 44px minimum the rest of the app holds to.
5. `ConfirmDialog` styles the confirming action as a red outline and the cancel as solid green. A reviewer called this inverted; it is a **documented deliberate choice** from an earlier PR (green = keeps your work). Left alone pending a decision.

**Current state: `main` is clean, builds and lints with zero errors/warnings, at v2.0.0.**

## Lesson learned: never run multiple agents against the same data file concurrently

During PR #7, three background content-editing agents were dispatched in parallel, all targeting `data/questions/language-skills.json` (different topics: Para Forming, Sentence Completion, Reading Comprehension/Vocabulary). They collided — each did a full-file read-modify-write, and whichever wrote last silently clobbered the others' work (and my own direct edits made in between). This wasn't caught by any agent's self-report; only independent verification (re-reading the file fresh and checking against expected state) caught it. Recovery required resuming each agent serially (one at a time, waiting for full completion + verification before starting the next) rather than trying to merge divergent edits.

**Rule going forward: never dispatch more than one agent with write access to the same file at the same time.** If multiple content edits are needed on one file, either do them yourself sequentially, or dispatch agents one at a time and verify each one's result against the actual current file state before starting the next. This is the same class of near-miss documented elsewhere in this file (the `git mv` question-bank-relocation near-miss) — concurrent writers to shared state in this repo have bitten this project twice now.

Stale local+remote branches from already-merged PRs still exist and were NOT cleaned up (not destructive, left for the user to decide): `chore/versioning-workflow`, `feature/question-bank-expansion-and-random-draw`, `feature/ui-theme-and-navigation`, `feature/batch-ux-content-overhaul`, `feature/gov-design-polish`, `feature/gov-design-typography`. Safe to delete (all merged), but ask before doing so since it's a git-history-visible action.

## Open loop status

The PDF-answer-key review loop mentioned in earlier versions of this doc is **closed** — the user came back with a feedback batch (pause screen copy, transitions, PQRS predictability, topic bunching, RC overload, weak distractors, a specific modifier-question bug, progress-grid coloring) and all of it shipped in PR #7 (v1.5.0), see above. No PDF-review open loop remains as of this writing.

If asked to regenerate the answer-key PDF in the future: one-off Node script (`data/questions/*.json` → self-contained HTML using local KaTeX assets from `node_modules/katex` → headless Chrome `--print-to-pdf`, no new npm dependencies needed). Pattern: build HTML with `renderMathInElement` from `node_modules/katex/dist/contrib/auto-render.min.js`, then `"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf=<out>.pdf <file>.html`. Not committed to the repo (it's a report generator, not app code).

## Environment quirks worth knowing

- **Windows + Git Bash.** The Bash tool runs Git Bash (POSIX sh), not cmd/PowerShell. A separate PowerShell tool is also available.
- **`gh` CLI is installed but not on the Bash tool's default PATH** — every `gh`-using Bash command needs `export PATH="$PATH:/c/Program Files/GitHub CLI"` prefixed (shell state doesn't persist across separate Bash tool calls).
- Chrome and Edge are both installed at their standard paths (`C:\Program Files\Google\Chrome\Application\chrome.exe`, `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) — useful for headless PDF generation or other browser-CLI needs; no `pandoc`/`wkhtmltopdf` installed.
- `pdftoppm`/poppler-utils are NOT installed, so the `Read` tool cannot render PDF pages to images in this environment — can't visually self-check generated PDFs that way; verify via the source HTML in a real browser (chrome-devtools MCP) instead, since the PDF is a print of that HTML.
- A `chrome-devtools` MCP integration is available and was used throughout for live browser verification (screenshots, DOM/script evaluation, viewport resizing) — use it to actually verify UI changes rather than assuming from code alone, per the project's "test the golden path in a browser" expectation.
- Dev server: `npm run dev` (Turbopack), typically on `http://localhost:3000`. Build: `npm run build`. Lint: `npm run lint` (must pass with zero errors before every merge, per team-workflow discipline even though it's not written as an explicit CLAUDE.md rule).

## User preferences (persisted in this agent's cross-session memory, but restated here in case a fresh agent has no memory access)

- **Always post the live `http://localhost:3000` link when returning to chat after finishing a task** — the user wants a one-click way to check results without asking. Make sure the dev server is actually running before posting the link.
- The user has, in past sessions, granted broad time-boxed autonomy ("auto-approve everything until 6AM," later extended to 12 noon) — but that authorization is time-boxed and conversation-specific, not a standing grant. A new session should NOT assume blanket autonomy; check current conversation context for explicit authorization before taking risky/irreversible actions.
- The user reacts well to autonomous, thorough work (multi-agent research/review dispatches, self-caught bugs, live browser verification) but has corrected scope creep before (e.g. "one PR per batch, not one per item"; "don't go for anything too fancy" on design). Default to disciplined, scoped execution over speculative expansion.
