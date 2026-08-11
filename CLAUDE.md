@AGENTS.md

# Development Workflow (standing rule — no exceptions)

## Versioning
- Semantic versioning (MAJOR.MINOR.PATCH), tracked in `VERSION.txt` at the repo root. Internal tracking only — not displayed in the app UI.
- Commit `6769f52` ("initial build for main") on `main` is the v1.0.0 baseline. Every commit on `main` after that must carry a version strictly above 1.0.0.
- Bump size (major/minor/patch) is judgment-based on the nature of the change: patch for fixes/tweaks, minor for additive non-breaking features, major for breaking changes.

## Git workflow
- Never commit directly to `main`. Every change goes through a feature branch + pull request — no exceptions.
- For each feature/change request:
  1. Create a new branch.
  2. Implement the change, keeping commits as modular as possible — one feature/concern per commit — so version history maps cleanly to bug tracking.
  3. Commit with a detailed summary of all changes.
  4. Push the branch.
  5. Open a pull request.
  6. Dispatch review agents to check the PR for bugs/logic issues; address feedback.
  7. Once reviewers approve, bump `VERSION.txt` on the branch per the versioning rule above.
  8. Merge the PR. The merge commit must include the new version name as a visible comment, so the version is visible at a glance when reviewing history.
