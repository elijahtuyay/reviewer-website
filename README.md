# reviewer-website

An online reviewer/quiz app for NMAT by GMAC, with provisions to add more exams in the future.

Simulates the real exam: 108 questions across three independently-timed sections (Language Skills, Quantitative Skills, Logical Reasoning), matching official question counts, timing, and relative difficulty. After submitting, every question is reviewed with the correct answer and a written explanation.

The question bank is a curated set of original questions (not AI-generated at request time) so answers and explanations stay accurate.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS. No backend/database in v1 — question bank lives in versioned JSON, structured so a backend (accounts, saved history, payments) can be added later without a rewrite.

## Hosting

Every route is prerendered at build time (`generateStaticParams` + `dynamicParams = false` on the exam and quiz segments), so `next build` produces a site with **no server-rendered-on-demand routes at all**. Confirm with the route table printed by `npm run build`: every entry should be marked `○ (Static)` or `● (SSG)`.

That matters for choosing a host: there is no runtime Node.js requirement, no database, and no request-time secret. Anything that can serve static files plus a Next.js adapter will do, and a purely static CDN will do once you accept that redeploys are the only way content changes.

### Environment

| Variable               | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin (no trailing slash). Feeds `metadataBase`, `sitemap.xml`, and `robots.txt`. Defaults to `http://localhost:3000` when unset, so a deploy without it emits localhost URLs in the sitemap. |

Set it in the host's environment before the first production build.
