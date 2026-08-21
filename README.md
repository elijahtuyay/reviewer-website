# reviewer-website

An online reviewer/quiz app for NMAT by GMAC, with provisions to add more exams in the future.

Simulates the real exam: 108 questions across three independently-timed sections (Language Skills, Quantitative Skills, Logical Reasoning), matching official question counts, timing, and relative difficulty. After submitting, every question is reviewed with the correct answer and a written explanation.

The question bank is a curated set of original questions (not AI-generated at request time) so answers and explanations stay accurate.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding an exam

Exams are drop-in modules. To add one:

1. Create `lib/exams/<id>/index.ts` default-exporting an `ExamModule` (the contract is `lib/exams/types.ts`).
2. Put its question JSON under `data/questions/<id>/` and wire it with `jsonBank({...})`.
3. Import it in `lib/exams/registry.ts` and add it to the `MODULES` array.

That is the whole checklist. Routes (`/<id>` and `/<id>/quiz/<section>`), the home-page card, the setup page, the section lock, the sitemap, the footer, and the quiz engine all read from the registry, so the new exam appears everywhere at once.

An `ExamModule` declares how the exam BEHAVES rather than leaving the app to branch on its id:

| Field | What it controls |
| --- | --- |
| `rules.navigation` | `"free"` (whole section on one page) or `"sequential"` (one question at a time). Selects the runner. |
| `rules.allowSkip` | Whether the next question is reachable without an answer. |
| `rules.adaptive` | Null, or the difficulty ladder: where to start and how long a streak moves it. |
| `rules.reviewEdit` | Null, or a capped post-section review pass with flagging. |
| `rules.sectionOrder` | Whether the candidate chooses the order of sections. |
| `rules.lockToOneSection` | Whether starting a section locks the others. |
| `scoring` | `points` (marks per correct answer) or `scaled` (a band weighted by difficulty, with an unanswered penalty). |

If you find yourself writing `if (examId === "...")` outside `lib/exams/`, add a rule instead.

Run `npm run verify:engine` after touching `lib/adaptive.ts` or `lib/scoring.ts`; it exercises the difficulty ladder and both scoring models.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS. No backend/database in v1 — question bank lives in versioned JSON, structured so a backend (accounts, saved history, payments) can be added later without a rewrite.

## Hosting

Every route is prerendered at build time (`generateStaticParams` + `dynamicParams = false` on the exam and quiz segments), so `next build` produces a site with **no server-rendered-on-demand routes at all**. Confirm with the route table printed by `npm run build`: every entry should be marked `○ (Static)` or `● (SSG)`.

That matters for choosing a host: there is no runtime Node.js requirement, no database, and no request-time secret. Any host with a Next.js adapter will serve this.

One caveat if you are tempted by a dumb file server: prerendered 404s (e.g. `/gmat/quiz/quant`) carry their status in `.meta` sidecars that only a Next-aware runtime reads. A plain static CDN would serve those "Page not found" pages with HTTP 200 — a soft 404. Use an adapter, or run `output: "export"` and accept its constraints, rather than uploading `.next` to a bucket.

### Environment

| Variable               | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL` | Canonical **origin** — scheme and host only, no path, no trailing slash (`https://example.com`). Feeds `metadataBase`, `sitemap.xml`, and `robots.txt`. Defaults to `http://localhost:3000` when unset, so a deploy without it emits localhost URLs in the sitemap. A subpath value (`https://example.com/app`) is not supported: `metadataBase` would resolve canonicals against the origin while the sitemap kept the subpath, and the two would disagree. |

Set it in the host's environment before the first production build.
