import Link from "next/link";
import type { Metadata } from "next";
import { AVAILABLE_EXAMS, EXAM_LIST, totalMinutes, totalQuestions } from "@/lib/exams/registry";
import { ExamModule } from "@/lib/exams/types";
import { loadSection } from "@/lib/question-bank";
import { AFFILIATION_DISCLAIMER, SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { joinWithAnd } from "@/lib/text";
import { SITE_URL } from "@/lib/site-url";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

/**
 * The home page is the product's front door, and with more than one exam in the
 * registry its job is to route you to the right one rather than to sell a
 * single exam. Per-section start buttons live on each exam's own page, where
 * they can respect that exam's rules.
 *
 * Everything here iterates the registry. Adding an exam module puts a card in
 * the picker and an entry in the footer without this file changing at all.
 */

/** Server-side only: this page is statically prerendered, so the banks never reach the browser. */
async function bankSize(exam: ExamModule): Promise<number> {
  const banks = await Promise.all(exam.sections.map((s) => loadSection(exam.id, s.id)));
  return banks.reduce((sum, b) => sum + b.length, 0);
}

export default async function Home() {
  const exams = await Promise.all(
    EXAM_LIST.map(async (exam) => ({ exam, bank: exam.available ? await bankSize(exam) : 0 }))
  );
  const totalBank = exams.reduce((sum, e) => sum + e.bank, 0);
  const availableCount = AVAILABLE_EXAMS.length;
  const faqs = buildFaqs(totalBank, availableCount);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE_NAME,
        description: SITE_TAGLINE,
        inLanguage: "en",
      },
      ...AVAILABLE_EXAMS.map((exam) => ({
        "@type": "Course",
        "@id": `${SITE_URL}/${exam.id}#course`,
        name: `${exam.label} practice exam`,
        description: exam.description,
        url: `${SITE_URL}/${exam.id}`,
        isAccessibleForFree: true,
        provider: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
        disclaimer: AFFILIATION_DISCLAIMER,
      })),
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
    ],
  };

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* Built from our own constants, never user input. JSON.stringify does not
          escape "<", so it is escaped explicitly rather than relying on nobody
          ever putting markup in an exam label. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <Hero exams={AVAILABLE_EXAMS} totalBank={totalBank} />

      <ExamPicker exams={exams} />
      <HowItWorks />
      <FeatureBands />
      <Faq faqs={faqs} />
      <ClosingCta />
    </div>
  );
}

/* ------------------------------------------------------------------ hero -- */

function Hero({ exams, totalBank }: { exams: ExamModule[]; totalBank: number }) {
  // Named, not counted. A visitor who already knows they want the NMAT could not
  // tell from anything above the fold that this site covers it: the headline
  // names no exam, the eyebrow said "graduate admissions practice", and the
  // subhead said "2 exams". The only occurrence of either name was in the nav.
  //
  // The names now sit in the eyebrow rather than mid-paragraph, which is where
  // a visitor scanning the fold actually looks, and it lets the paragraph below
  // spend its first sentence on something other than repeating the nav.
  // joinWithAnd, not .join(" and "): at three exams a plain join reads
  // "NMAT and GMAT and GRE".
  const names = joinWithAnd(exams.map((e) => e.shortLabel));
  return (
    // The one saturated surface on the site, and deliberately the ROOT accent
    // rather than an exam's: this page sits above every exam, so borrowing one
    // exam's color here would make the platform look like it belongs to it.
    // `on-accent` flips --focus-ring to the accent's own foreground. Without it
    // the ring is accent-on-accent: 1.00:1, i.e. no focus indicator at all on
    // the two primary calls to action of the entire site.
    <section className="on-accent relative overflow-hidden bg-accent text-accent-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/0 via-black/10 to-black/30"
      />
      <div className="relative mx-auto w-full max-w-5xl px-6 py-20 text-center sm:py-28">
        <p className="label-caps opacity-90">
          {names} practice
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-3xl leading-tight font-bold text-balance sm:text-4xl md:text-5xl">
          Take a real timed section today.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed opacity-90 sm:text-lg">
          The section lengths, the time limits and the rules about what you can skip follow each
          exam&rsquo;s own published format. We write all{" "}
          {totalBank.toLocaleString("en-US")} questions here, and each one has an explanation you read
          after you submit. You pay nothing, and you need no account.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="#exams"
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-accent-foreground px-7 text-sm font-semibold text-accent transition hover:opacity-90 active:scale-[0.98] sm:w-auto"
          >
            Select your exam
          </Link>
          <Link
            href="#how-it-works"
            className="flex min-h-12 w-full items-center justify-center rounded-lg border border-current px-7 text-sm font-semibold transition hover:bg-black/15 active:scale-[0.98] sm:w-auto"
          >
            See how it works
          </Link>
        </div>

        {/* Direct routes, deliberately quieter than the two buttons above.
            Both of those scroll rather than navigate, so a visitor who arrived
            already knowing which exam they wanted had nothing to click — but
            they are still the primary action, so these sit underneath as text
            rather than competing as a second row of buttons. */}
        <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm opacity-90">
          <span>Do you know which exam you want?</span>
          {exams.map((exam, i) => (
            <span key={exam.id} className="flex items-center gap-2">
              {i > 0 && (
                <span aria-hidden className="opacity-60">
                  &middot;
                </span>
              )}
              <Link
                href={`/${exam.id}`}
                className="inline-flex min-h-11 items-center rounded font-semibold underline underline-offset-4 transition hover:opacity-80"
              >
                Practice the {exam.shortLabel}
              </Link>
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- exam picker -- */

function ExamMark({ exam }: { exam: ExamModule }) {
  return (
    // Inline style, not a Tailwind class: the color comes from the exam module
    // at runtime, and this card sits outside that exam's theme scope.
    <span
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
      style={{ backgroundColor: exam.theme.accent, color: exam.theme.accentForeground }}
    >
      {exam.shortLabel.slice(0, 4)}
    </span>
  );
}

function ExamPicker({ exams }: { exams: { exam: ExamModule; bank: number }[] }) {
  return (
    <section id="exams" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="label-caps text-accent-text">
            Select your exam
          </p>
          <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
            The rules change with the exam
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            The section lengths, the time limits, the skip rules and the adaptive difficulty all
            depend on the exam you select. Each card below lists what changes.
          </p>
        </div>

        {/*
          Three up once there is room, because three cards do not need the width
          a two-up card gets.

          Between `md` and `lg` this IS two columns with a third card alone in
          row two. That is deliberate and the earlier comment here was wrong to
          imply otherwise: at 768px the alternative is three full-width cards in
          one column, which is worse, and the orphan is one short row rather
          than a hole in the middle of the grid.

          Both class strings are written out in full, because Tailwind scans
          source text and never sees a computed class name.
        */}
        <div
          className={`mt-10 grid gap-6 ${
            exams.length >= 3 ? "md:grid-cols-2 lg:grid-cols-3" : "lg:grid-cols-2"
          }`}
        >
          {exams.map(({ exam, bank }) => (
            <article
              key={exam.id}
              className="flex flex-col rounded-xl border border-line bg-panel p-6"
            >
              <div className="flex items-start gap-4">
                <ExamMark exam={exam} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">{exam.label}</h3>
                    {!exam.available && (
                      <span className="rounded-full bg-panel-hover px-2 py-0.5 text-xs font-medium text-muted">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{exam.description}</p>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-line py-4 text-center">
                <div>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">{exam.sections.length}</dd>
                  <dt className="text-xs text-muted">sections</dt>
                </div>
                <div>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">{totalQuestions(exam)}</dd>
                  <dt className="text-xs text-muted">questions</dt>
                </div>
                <div>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">{totalMinutes(exam)} min</dd>
                  <dt className="text-xs text-muted">of testing</dt>
                </div>
              </dl>

              <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-sm text-muted">
                {examHighlights(exam, bank).map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden className="text-accent-text">
                      &bull;
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={`/${exam.id}`}
                className="mt-6 flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: exam.theme.accent, color: exam.theme.accentForeground }}
              >
                {exam.available
                  ? `Practice the ${exam.shortLabel}`
                  : `See the ${exam.shortLabel} format`}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Derived from the exam's declared rules rather than written per exam, so a new
 * module gets an accurate summary for free and an existing one cannot drift
 * out of sync with how it actually behaves.
 */
function examHighlights(exam: ExamModule, bank: number): string[] {
  const lines: string[] = [];
  const sectionMinutes = new Set(exam.sections.map((s) => s.minutes));
  lines.push(
    sectionMinutes.size === 1
      ? `Each section has its own ${[...sectionMinutes][0]}-minute time limit`
      : "Each section has its own time limit"
  );

  lines.push(
    exam.rules.adaptive
      ? "The questions become harder after two correct answers and easier after two incorrect ones"
      : "Each attempt uses a new random set of questions"
  );
  // Stated rather than implied: a section that draws most of its bank repeats
  // itself on a retake, and claiming "a different set every time" for such an
  // exam would be false.
  const perSitting = Math.max(...exam.sections.map((s) => s.questionCount));
  if (bank > 0 && perSitting / (bank / exam.sections.length) > 0.5) {
    lines.push("The question bank is small, so a retake repeats some of the questions");
  }

  if (!exam.rules.allowSkip) {
    lines.push("You must answer each question before the next question appears");
  }
  // Two lines that describe a FIXED-PAPER exam, which had almost nothing to say
  // about itself: every other rule here is phrased as a departure from that
  // shape, so NMAT generated three bullets against GMAT eight and its card read
  // as the unfinished one beside them.
  if (exam.rules.navigation === "free") {
    lines.push("The whole section is on one page, so you can answer in any order");
  }
  if (exam.scoring.kind === "points") {
    lines.push(
      `Each correct answer is worth ${exam.scoring.pointsPerCorrectAnswer} points, and an incorrect one costs nothing`
    );
  }
  if (exam.rules.reviewEdit) {
    lines.push(
      `You can flag questions, then change up to ${exam.rules.reviewEdit.maxChanges} answers if time remains`
    );
  }
  if (exam.rules.sectionOrder !== "fixed") {
    lines.push("You can take the sections in any order");
  }
  if (exam.scoring.kind === "scaled") {
    lines.push(
      `The score runs from ${exam.scoring.min} to ${exam.scoring.max} and includes question difficulty`
    );
  }

  lines.push(
    bank > 0
      ? `${bank.toLocaleString("en-US")} questions in the question bank`
      : "The question bank is not ready yet"
  );
  /*
   * Capped, because the cards stretch to a shared height and the lists ran 3,
   * 8 and 5. The three-item card carried roughly 300px of dead space above its
   * button and read as the unfinished one, which is the opposite of what a
   * bank of 300 questions has earned.
   *
   * The bank count is pushed last and is the line worth keeping, so the cap
   * drops from the middle rather than the end.
   */
  const CAP = 5;
  if (lines.length > CAP) return [...lines.slice(0, CAP - 1), lines[lines.length - 1]];
  return lines;
}

/* ---------------------------------------------------------- how it works -- */

/** Steps are instructions, so ASD-STE100 caps them at 20 words a sentence. */
const STEPS = [
  {
    title: "Select an exam and a section",
    body: "The timer starts when you open the section. The other sections stay locked until you submit this one.",
  },
  {
    title: "Answer the questions",
    body: "Press Pause if you need to stop the timer. When it reaches zero, the section submits your answers and scores them.",
  },
  {
    title: "Read the explanations",
    body: "You get your score and a result for each topic. You then see every question again, with its correct answer and an explanation.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 border-b border-line bg-panel">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="label-caps text-accent-text">
            How it works
          </p>
          <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
            Three steps to a scored section
          </h2>
        </div>

        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full border border-accent-text text-sm font-bold text-accent-text"
              >
                {i + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- features -- */

const FEATURES = [
  {
    eyebrow: "The real exam format",
    title: "Practice with the real time limits",
    // STE caps sentence LENGTH; it does not ask for a page of subject-verb-object
    // declaratives, and an unbroken run of them reads like a spec sheet on a
    // page whose job is to earn trust. So the lengths here run long, medium,
    // short on purpose, and the paragraph does not end on a slogan.
    body: "The question counts and the time limits follow each exam's published structure. Open one section and the others lock until you submit it. The timer continues even when you move to a different browser tab. Only the Pause button stops it, and the screen then says the timer is stopped.",
    points: [
      "Each section has its own timer, and the timer does not reset when you reload the page",
      "Pause blurs the questions and stops the timer",
      "When the timer reaches zero, the section submits and scores your answers",
    ],
  },
  {
    eyebrow: "Written before you ask",
    title: "Every answer has an explanation",
    // The claim is that the explanation is written and reviewed BEFORE you ask,
    // and is kept under version control. That is what the old copy claimed and
    // what this project can stand behind. "A person writes every question" is a
    // stronger and different claim, and it briefly appeared in four places
    // including the affiliation disclaimer, which is a legal notice.
    body: "We write each question and each explanation for this site, and we keep every version under review. The explanation is therefore the author's reasoning, not the output of a language model at the moment you ask. The incorrect options are plausible on purpose, because each one matches a mistake candidates make.",
    points: [
      "A written explanation on every question",
      "Balanced answer positions and answer lengths, so a guess pattern fails",
      "A result for each topic, so you see where you lost the points",
    ],
  },
  {
    // "every format", not "two formats". Every other count on this page comes
    // from the registry, and the one hand-written count in the app named only
    // NMAT for two releases after the GMAT shipped.
    eyebrow: "One engine, every format",
    title: "The difficulty changes with your answers",
    body: "On an adaptive exam the questions come one at a time, and they become harder after two correct answers in a row. Your score then includes the difficulty of each question you answered, not only the number you answered correctly. A fixed paper is different. You see the whole section at once, and you can leave a question and return to it later.",
    points: [
      "The difficulty changes with your recent answers",
      "The score includes question difficulty, not only the count",
      "Each exam has its own rules for skips, flags and answer changes",
    ],
  },
];

function FeatureBands() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-16 sm:gap-20 sm:py-20">
        {FEATURES.map((feature, i) => (
          <div key={feature.title} className="grid items-start gap-8 lg:grid-cols-2 lg:gap-14">
            {/* Sides alternate on wide screens only, so the reading order on a
                phone stays one consistent column. `order` moves the visual
                position without touching DOM order, which keeps each heading
                ahead of its own list for screen readers. */}
            <div className={i % 2 === 1 ? "lg:order-2" : undefined}>
              <p className="label-caps text-accent-text">
                {feature.eyebrow}
              </p>
              <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
                {feature.title}
              </h2>
              <p className="mt-4 leading-relaxed text-muted">{feature.body}</p>
            </div>
            <ul className={`flex flex-col gap-3 ${i % 2 === 1 ? "lg:order-1" : ""}`}>
              {feature.points.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-lg border border-line bg-panel px-4 py-3.5 text-sm text-foreground"
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 20 20"
                    className="mt-0.5 h-4 w-4 shrink-0 text-accent-text"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m4 10.5 4 4 8-9" />
                  </svg>
                  <span className="leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- faq -- */

interface FaqEntry {
  q: string;
  a: string;
}

function buildFaqs(totalBank: number, examCount: number): FaqEntry[] {
  return [
    {
      q: "Is it really free?",
      a: "Yes. There is no payment and no account. Select a section and start. Accounts and a saved attempt history are future plans, and the practice itself is free.",
    },
    {
      q: "Are these real exam questions?",
      a: `No. Real exam questions are copyright material. We write every one of the ${totalBank.toLocaleString(
        "en-US"
      )} questions for this site. The topic mix, the difficulty and the style follow each exam's published structure. Do not trust any site that offers you real exam questions.`,
    },
    {
      q: "Which exams can I practice?",
      a: `${
        examCount === 1 ? "One exam is" : `${examCount} exams are`
      } ready now. Each exam follows its own published format, down to the section lengths and the skip rules. Adding an exam later does not change how the current ones behave.`,
    },
    {
      q: "Does my progress save?",
      a: "Yes, but only in this browser tab. Your answers and your remaining time survive a page reload, and they survive when you move to another page on this site. The browser deletes them when you close the tab, which is deliberate: a half-spent timer from three days ago helps nobody.",
    },
    {
      q: "Can I retake a section?",
      a: "Yes, as many times as you want. The difference between two attempts depends on the size of the question bank. A section that draws 36 questions from a bank of 100 is almost a new paper each time. A small bank repeats more of its questions. Each exam card above shows the size of its bank.",
    },
    {
      q: "What happens when the time ends?",
      a: "The section submits your answers and scores them. It also tells you that the time ended. You still see every question, its correct answer and an explanation, including the questions you never reached. On an adaptive exam an unanswered question costs you more than an incorrect answer. The real exam behaves the same way.",
    },
    {
      q: "Does it work on a phone?",
      a: "Yes. On an exam that shows a whole section at once, the question list moves into a bottom sheet on a small screen. On an exam that shows one question at a time, there is no list to open. Every control is large enough to tap. A long reading passage is easier on a large screen, but you can reach everything on a phone.",
    },
  ];
}

function Faq({ faqs }: { faqs: FaqEntry[] }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-20">
        <p className="label-caps text-accent-text">
          Common questions
        </p>
        <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">Before you start</h2>

        {/* Native <details>, not a JS accordion: it works before hydration, it
            is keyboard-operable and announced correctly for free, and browser
            find-in-page can still reach text inside a closed one. */}
        <div className="mt-8 flex flex-col gap-3">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-lg border border-line bg-panel px-5 open:pb-5"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-sm font-semibold text-foreground transition-colors marker:content-none hover:text-accent-text">
                {faq.q}
                <svg
                  aria-hidden
                  viewBox="0 0 20 20"
                  className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 7.5 5 5 5-5" />
                </svg>
              </summary>
              <p className="text-sm leading-relaxed text-muted">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- closing cta -- */

function ClosingCta() {
  return (
    // A faint accent wash rather than --panel: the site footer directly below
    // is already --panel, and two adjacent panels merged into one slab with no
    // visible end to the page.
    <section className="bg-accent/5 dark:bg-accent/10">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 text-center sm:py-20">
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Start with one section</h2>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted">
          Give it the full time limit. When you submit, the explanations tell you what to study
          next.
        </p>
        <Link
          href="#exams"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-accent px-8 text-sm font-semibold text-accent-foreground transition hover:opacity-90 active:scale-[0.98]"
        >
          Select your exam
        </Link>
        <p className="mt-4 text-xs text-muted">
          Free, and no account. {SITE_NAME} is an independent study tool.
        </p>
      </div>
    </section>
  );
}
