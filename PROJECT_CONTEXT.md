# Project Context — NMAT Reviewer

**Read this file fully before doing anything.** It's a handoff document written for a brand-new Claude Code session with zero memory of prior work on this repo. Last updated: 2026-08-15, at `main` HEAD `d3479a6`, VERSION.txt `1.5.0`.

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

Three reference books exist at `C:\Users\elija\Downloads\test\`:
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
- `lib/local-progress.ts`: localStorage keyed `progress:${examId}:${section}`. Both read and write paths are wrapped in try/catch (write-side catch was added later — see bug history).
- `lib/scoring.ts`: `scoreAttempt(questions, answers, pointsPerCorrectAnswer)`.
- `lib/section-result.ts`: `getSectionBreakdown(examId, sectionId, fallbackTotal)` — powers the post-submit sidebar correct/wrong/skipped breakdown.

### Question bank content
- **300 questions total**, 100 per section (`language-skills`, `quantitative-skills`, `logical-reasoning`), stored in `data/questions/*.json`.
- **36 questions are drawn randomly per attempt** from each 100-question pool via Fisher-Yates shuffle (`drawRandomQuestionIds`), *"to truly test them"* per the user's explicit design intent — not the same 36 every time.
- Difficulty distribution, verified on disk, identical across all 3 files: **15 easy / 45 medium / 40 hard**.
- Topic ratios were rebalanced against real NMAT Official Guide chapter proportions (counted by hand from the reference book's actual practice chapters, e.g. logical-reasoning: Critical Reasoning 19% / Deductions 16% / Analytical Puzzles 36% / Other 29%, matching the real book's ~18.6/16.3/35.7/29.3 split).
- Zero em dashes (—) in any user-facing `prompt`/`explanation`/option text (repo-wide "AI slop" removal was explicit user direction).
- Currency: **use the peso sign (₱), not `$`**, in question text. This is not a style preference — literal `$` collides with the app's KaTeX math-delimiter parser (see Known Issues #3 below). 24 quantitative-skills questions were already fixed; if you add new money-related questions, use `₱` from the start.
- Math notation: inline LaTeX delimited by single `$...$` (e.g. `"If $x^2 = 9$, what is x?"`), rendered by `components/MathText.tsx` via `react-katex`. Literal `\n` in prompt/explanation text becomes a real line break (used for table/list-style questions).
- Schema per question (see `data/schema.ts` `Question` type): `id`, `section`, `topic`, `difficulty` (`"easy"|"medium"|"hard"`), `prompt`, `options: string[]`, `correctIndex`, `explanation`, `source` (e.g. `"original"`).

### UI/UX conventions currently in place
- Apple-style page transitions: `components/PageTransition.tsx`, a pathname-keyed CSS fade-remount (NOT React's experimental `<ViewTransition>` — deliberately avoided as too fragile for this Next.js version). Respects `prefers-reduced-motion`.
- Sticky "freeze-pane" quiz header (`h-20`) + sticky sidebar (`top-24` — the math is `80px header + 16px gap = 96px = top-24`, don't break this alignment if you resize the header).
- Full-screen anti-cheat pause overlay (`components/PauseOverlay.tsx`): blurred backdrop, freezes the `Timer`, and the underlying quiz content is marked `inert` (React 19 native attribute) while paused — this removes it from both pointer interaction AND keyboard tab order, not just visual pointer-events blocking.
- Mobile nav: below the `lg` Tailwind breakpoint, the desktop sidebar (`SectionNav` + `ProgressTracker`) is hidden. `components/MobileNavSheet.tsx` is the mobile fallback — a bottom sheet triggered by a "Sections" header button, with Escape-to-close, body scroll-lock, and the background marked `inert` while open (mirrors the pause-overlay pattern).
- Focus-visible ring: global `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` in `app/globals.css` — added specifically because all three researched government design systems (see below) treat visible focus as non-negotiable.
- Answer correctness in review mode is shown by **both color AND a text label** ("Correct answer" / "Your answer") — never color alone (WCAG requirement, was a real bug, fixed in PR #6).
- Design philosophy: the user explicitly asked to model UI conventions on **first-world government websites (US/Canada/Singapore)** — USWDS, Canada.ca (GC Design System), Singapore's SGDS — researched live via WebSearch. Applied *principles* (restraint, accessibility, clear typographic hierarchy, minimal functional-only motion, visible focus states, 44px tap targets) rather than a visual reskin. Explicit user instruction: **"don't go for anything too fancy."** Do not redesign colors/spacing/typography wholesale without being asked again.
- Timer (`components/Timer.tsx`): **deadline-based, not tick-counted.** It computes remaining time from `Date.now()` vs. a stored deadline on every tick, not by decrementing a counter — this was a real bug fix (browsers throttle `setInterval` in backgrounded tabs, which used to silently grant free exam time). Pause shifts the deadline forward by the paused duration. Has a `visibilitychange` listener for immediate correction on tab refocus. If you touch this file, do NOT reintroduce `Date.now()` calls inside the render body — React's `react-hooks/purity` lint rule will fail the build; deadline initialization must happen inside a `useEffect`.

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

**Current state: `main` is clean, builds and lints with zero errors/warnings, at v1.5.0.**

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
