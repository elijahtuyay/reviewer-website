# NMAT Reviewer Platform

## Problem
Candidates preparing for NMAT by GMAC (the GMAC-administered India MBA entrance exam) need realistic, structured practice with trustworthy answers. Generic quiz sites don't match the exam's actual section structure, timing, or difficulty distribution. Official GMAC practice materials are limited in free quantity. AI-generated practice questions are the obvious "at-scale" alternative, but LLMs hallucinate — a wrong answer key or a confidently-wrong explanation is worse than no practice tool at all for something a candidate is trusting to prepare for a real, consequential exam.

## Evidence
- Founder/user's own stated need: building this as a personal reviewer tool, inspired by an existing reviewer site (cseexamreviewer.com) that does the same for a different exam (Philippine Civil Service Examination).
- Explicit, repeated design constraint from the user: answers and explanations must come from a curated, verified question bank — not generated live by AI — specifically *because* of known LLM hallucination risk. This shaped the core architecture (static question bank vs. live generation) from the first requirements conversation.
- Real exam structure (section counts, timing, scoring, difficulty distribution) was independently researched against official GMAC sources and reputable prep sites (mba.com, Career Launcher, Cracku, IMS India, Hitbullseye) rather than assumed — see Appendix.
- Broader-than-builder demand: **Assumption — needs validation via real usage/feedback** once the site has users beyond the builder.

## Users
- **Primary**: Self-directed NMAT by GMAC candidates practicing online, starting with the site's own builder as the first (beta) user.
- **Not for** (currently): candidates for other entrance exams (planned future expansion, not yet built); users wanting a conversational/AI-tutor experience rather than a fixed practice-test format.

## Hypothesis
We believe a **realistic, timed, curated-question-bank reviewer with instant, explained review** will help NMAT candidates practice more effectively than generic quiz apps or unverified AI-generated practice sets.
We'll know we're right when **TBD — needs validation via real usage (self-tracked score improvement across attempts, and/or feedback once shared beyond the builder)**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Section completion rate | TBD | Not yet instrumented — no analytics/backend in v1 |
| Repeat usage (multiple sessions/attempts) | TBD | Not yet instrumented |
| Self-reported readiness/confidence | TBD | Informal, pending real exam attempt or user feedback |

No analytics exist yet (no backend). These are placeholders to fill in once the tool has real usage — see Open Questions.

## Scope

### MVP — built and shipped
- **NMAT by GMAC question bank**: 108 original, hand-verified questions (36 Language Skills / 36 Quantitative Skills / 36 Logical Reasoning) — a 1:1 count match to the real exam, with per-section difficulty weighted to reflect the real exam's relative difficulty (Quant hardest, Language Skills easiest).
- **Real exam fidelity**: per-section time limits matching the real exam (28 / 52 / 40 minutes), +3 points per correct answer, no negative marking, and a section-locking rule matching the real exam (you choose which section to start, but can't switch away from a section once it's in progress).
- **Timed quiz flow**: countdown timer per section, auto-submit on timeout, live "X/36 answered" progress.
- **Review screen**: every question marked correct/incorrect after submission, correct answer shown, and a written explanation for why — the core differentiator from a bare quiz tool.
- **Per-topic scoring breakdown** (e.g. "Data Sufficiency: 2/5") alongside the overall score.
- **Progress persistence**: in-progress and completed section answers persist to `localStorage`, so reloading or navigating away and back resumes state (no login required).
- **Exam setup / splash page** (`/nmat`): explains the format (timing, scoring, section-lock rule, what review looks like) before the candidate starts.
- **Home page** styled as a multi-exam platform, not an NMAT-only tool: hero + CTA, NMAT section preview (non-clickable — entry point is the setup page), and "coming soon" placeholders for Other Exams / Account / Upgrade.
- **Theming**: light mode (warm beige, not stark white) and dark mode (Discord/VSCode-like, not near-black), user-toggleable and persisted.
- **Backend-ready architecture**, built backend-free: thin data-access layer (`lib/data/questions.ts`) as the single swap point for a future database/API, pure scoring functions reusable from a future API route, and a `source` field on every question (`"original"` vs `"nmat-reviewer-pdf"`) so a future PDF import can merge into the same bank without a schema change.
- **Stack**: Next.js (App Router) + TypeScript + Tailwind CSS, no database, no auth, no payment integration.

### Out of scope (for now)
- **User accounts / authentication** — deferred; placeholder nav item only. No login exists; progress lives in browser `localStorage`, not tied to an identity.
- **Payments / monetization** — deferred; placeholder nav item only. Explicitly "not fleshed out yet" per the user.
- **Other exams** (college entrance exams, etc.) — deferred; the platform is styled and structured to support them later, but none are built.
- **Backend / database** — deferred; all content is static JSON, all progress is client-side `localStorage`.
- **Computer-adaptive difficulty** — the real NMAT is adaptive per section; this reviewer is intentionally fixed-form (same question set every attempt). Not currently planned to change.
- **Live AI-generated questions** — explicitly rejected as the core content strategy, by design, due to hallucination risk. (A future AI-assisted *authoring* aid, reviewed by a human before entering the bank, is a different and undecided question — see Open Questions.)

## Delivery Milestones
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Core NMAT reviewer MVP | Scaffold, schema, 108-question bank, timed quiz flow, scoring, review screen | complete | — |
| 2 | UX refinement pass | Beige/Discord-style theming, blue answer highlight, 6×6 progress tracker, section-lock sidebar, exam setup splash page, platform-style home page | complete | — |
| 3 | PDF-sourced question import | User's upcoming NMAT reviewer PDF merged into the bank via the existing `source` field | pending | — |
| 4 | User accounts | Persist progress/attempt history server-side instead of (or alongside) `localStorage` | pending | — |
| 5 | Payments / monetization | Not yet scoped — depends on what "upgrade" ends up meaning | pending | — |
| 6 | Additional exams | Extend beyond NMAT to other entrance exams | pending | — |

## Open Questions
- [ ] What exactly is in the incoming NMAT reviewer PDF, and how should it reconcile with the existing hand-written bank — supplement, replace weak sections, or both?
- [ ] Is this tool staying single-user (the builder's own study tool) or intended for a wider audience? This materially changes whether Milestones 4–5 (accounts, payments) are worth building at all.
- [ ] The real NMAT's format (section timing/question counts) can change year to year — who/what re-verifies the config in `lib/exam-config.ts` against official sources periodically?
- [ ] Which specific exams are the "other exams" — no candidates named yet.
- [ ] Should question-bank growth beyond the initial 108 ever use AI-assisted drafting with mandatory human verification before publishing, given the hard "no live AI generation" constraint on the *served* content?

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hand-authored question bank has an undetected error at scale | Medium | High — undermines the core "trustworthy answers" value prop | Spot-checked all 108 at build time; no independent second-pass review yet — worth doing before wider release |
| Real NMAT pattern changes (timing/question counts) go unnoticed | Low–Medium | Medium | Timing/counts centralized in one config file (`lib/exam-config.ts`) for fast correction |
| Scope creep into accounts/payments/adaptive-difficulty before the core product is validated | Medium | Medium | Explicitly deferred in this PRD; re-enter scope only via a new milestone, not ad hoc |
| No persistence across devices/browsers (localStorage only) | High (by design) | Low for a single-user tool, higher if this becomes multi-user | Accepted for v1; Milestone 4 addresses it if/when needed |

## Notes
<!-- Freeform space for incremental annotations as things come to mind. Add dated bullets below; nothing here is authoritative until folded into the sections above. -->

-

---
*Status: LIVING DOCUMENT — describes the current state of a partially-built product, not a pre-build proposal. Sections above reflect what exists as of this writing; use `/plan` against a pending milestone to scope its implementation.*
