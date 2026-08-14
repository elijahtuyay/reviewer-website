@AGENTS.md
@PROJECT_CONTEXT.md

# Development Workflow (standing rule — no exceptions)

## Versioning
- Semantic versioning (MAJOR.MINOR.PATCH), tracked in `VERSION.txt` at the repo root. Internal tracking only — not displayed in the app UI.
- Commit `6769f52` ("initial build for main") on `main` is the v1.0.0 baseline. Every commit on `main` after that must carry a version strictly above 1.0.0.
- Bump size (major/minor/patch) is judgment-based on the nature of the change: patch for fixes/tweaks, minor for additive non-breaking features, major for breaking changes.

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
  6. Autonomously dispatch review agents to check the PR — do not ask the user for permission to review first, this step always happens automatically. Reviewers should act as senior/lead engineers: check for bugs and logic issues, AND assess whether the built unit is faithful to the overall intended design, not just whether the code is locally correct. Apply any fixes the reviewers surface before proceeding.
  7. Once reviewers approve, merge the PR. The merge commit must include the new version name as a visible comment, so the version is visible at a glance when reviewing history.
