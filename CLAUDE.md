@AGENTS.md
@PROJECT_CONTEXT.md

# Development Workflow (standing rule — no exceptions)

## Versioning
- Semantic versioning (MAJOR.MINOR.PATCH), tracked in `VERSION.txt` at the repo root. Internal tracking only — not displayed in the app UI.
- Commit `6769f52` ("initial build for main") on `main` is the v1.0.0 baseline. Every commit on `main` after that must carry a version strictly above 1.0.0.
- Bump size (major/minor/patch) is judgment-based on the nature of the change: patch for fixes/tweaks, minor for additive non-breaking features, major for breaking changes.

## Code maintainability (standing rule)

When there is a choice between a short-term patch and a longer-term solution that requires rework or an overhaul but reduces future headache, **always choose the latter.** Fix causes at the level they actually live at: if the same problem would otherwise need re-patching at three call sites, fix it once in the shared layer. Prefer this even when it means touching more files than the immediate bug report implies.

## Concurrency rule for agents

Never dispatch more than one agent with write access to the same file at the same time. Multiple agents doing read-modify-write on one file silently clobber each other (this has bitten the project). Either do the edits yourself sequentially, or dispatch agents one at a time and verify each result against the actual file state before starting the next. Read-only agents may run in parallel freely.

## Git workflow
- Never commit directly to `main`. Every change goes through a feature branch + pull request — no exceptions.
- Scope a PR to one coherent unit of work, not one PR per tiny item. A single user request that lists many related fixes/tweaks (e.g. a batch of small UI/content changes) is ONE PR, not one PR per list item — fragmenting it clutters the log/reflog. A PR should still contain modular internal commits (one concern per commit) so individual changes stay bisectable, but don't multiply pull requests for what is really one delivered batch. Use judgment: genuinely separable, independently-shippable features (e.g. "the UI redesign" vs. "the question bank expansion" from an earlier batch) still warrant their own PRs.
- Never give a version bump its own standalone commit. Fold the `VERSION.txt` change into the last substantive commit of the PR (or amend it in before pushing) rather than adding a separate "chore: bump version" commit.
- For each PR:
  1. Create a new branch.
  2. Implement the change(s), keeping commits as modular as possible internally.
  3. Commit with a detailed summary of all changes (version bump included in the final commit, not separate).
  4. Push the branch.
  5. Open a pull request.
  6. Autonomously dispatch review agents to check the PR — do not ask the user for permission to review first, this step always happens automatically. Reviewers act as senior/lead engineers: check for bugs and logic issues, AND assess whether the built unit is faithful to the overall intended design, not just whether the code is locally correct. Apply any fixes the reviewers surface before proceeding.

     **Every PR gets one agent per review lane, dispatched together:**
     - **Logic** — the bulk of the work. Correctness, state transitions, effects/lifecycle, race conditions, storage and timer behavior, edge cases.
     - **Syntax and display** — math is in proper LaTeX, numbers/fractions render correctly, nothing regressed in colors/theme tokens, buttons and interactive elements actually work.
     - **User experience** — briefed as a brand-new user and prospective customer evaluating the site. Plays through every section and reports anything confusing, slow, or uncomfortable, plus concrete improvements.
     - **Correctness of content** — mandatory whenever the change touches the question bank. Re-checks every question the change claims to have reworked, verifies no answer correctness was altered by stray edits, and hunts for pre-existing wrong questions to rectify.

     Respect the concurrency rule below: reviewers are read-only, so they may run in parallel, but never give two agents write access to the same file at once.
  7. Once reviewers approve, merge the PR. The merge commit must include the new version name as a visible comment, so the version is visible at a glance when reviewing history.
