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
