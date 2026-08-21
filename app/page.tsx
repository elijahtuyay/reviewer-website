import Link from "next/link";
import type { Metadata } from "next";
import { AVAILABLE_EXAMS, EXAM_LIST, totalMinutes, totalQuestions } from "@/lib/exams/registry";
import { ExamModule } from "@/lib/exams/types";
import { loadSection } from "@/lib/question-bank";
import { AFFILIATION_DISCLAIMER, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

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
 * the picker, a row in the stats, and an entry in the footer without this file
 * changing at all.
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

      <Hero examCount={availableCount} totalBank={totalBank} />

      <StatBand
        stats={[
          { value: String(availableCount), label: availableCount === 1 ? "exam" : "exams, fully timed" },
          { value: totalBank.toLocaleString("en-US"), label: "questions written by hand" },
          { value: "Every one", label: "explained after you submit" },
          { value: "Free", label: "no account, no card" },
        ]}
      />

      <ExamPicker exams={exams} />
      <HowItWorks />
      <FeatureBands />
      <Faq faqs={faqs} />
      <ClosingCta />
    </div>
  );
}

/* ------------------------------------------------------------------ hero -- */

function Hero({ examCount, totalBank }: { examCount: number; totalBank: number }) {
  return (
    // The one saturated surface on the site, and deliberately the ROOT accent
    // rather than an exam's: this page sits above every exam, so borrowing one
    // exam's colour here would make the platform look like it belongs to it.
    <section className="relative overflow-hidden bg-accent text-accent-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/0 via-black/10 to-black/30"
      />
      <div className="relative mx-auto w-full max-w-5xl px-6 py-20 text-center sm:py-28">
        <p className="text-xs font-semibold tracking-widest uppercase opacity-90">
          Graduate admissions practice
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-3xl leading-tight font-bold sm:text-4xl md:text-5xl">
          Sit the real thing before you sit the real thing.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed opacity-90 sm:text-lg">
          {examCount === 1 ? "One exam" : `${examCount} exams`}, each built to its own published
          format: real section timings, {totalBank.toLocaleString("en-US")} questions written by
          hand, and a written explanation waiting behind every single answer. No sign-up, no
          paywall.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="#exams"
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-accent-foreground px-7 text-sm font-semibold text-accent transition hover:opacity-90 sm:w-auto"
          >
            Choose your exam
          </Link>
          <Link
            href="#how-it-works"
            className="flex min-h-12 w-full items-center justify-center rounded-lg border border-current px-7 text-sm font-semibold transition hover:bg-black/15 sm:w-auto"
          >
            See how it works
          </Link>
        </div>

        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-xs font-medium opacity-80 sm:text-sm">
          <li>Real section timings</li>
          <li aria-hidden>&middot;</li>
          <li>Every answer explained</li>
          <li aria-hidden>&middot;</li>
          <li>A different set every attempt</li>
        </ul>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- stats -- */

function StatBand({ stats }: { stats: { value: string; label: string }[] }) {
  return (
    <section className="border-b border-line bg-panel">
      <dl className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-x-6 gap-y-8 px-6 py-10 sm:grid-cols-4">
        {/* The number reads first, but a definition list requires the term
            before its description, so the label stays the term and flex
            `order` flips the visual sequence without reordering the DOM. */}
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col text-center">
            <dt className="order-2 mt-1 text-xs text-muted sm:text-sm">{stat.label}</dt>
            <dd className="order-1 text-2xl font-bold text-foreground sm:text-3xl">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ----------------------------------------------------------- exam picker -- */

function ExamMark({ exam }: { exam: ExamModule }) {
  return (
    // Inline style, not a Tailwind class: the colour comes from the exam module
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
          <p className="text-xs font-semibold tracking-widest text-accent-text uppercase">
            Pick your exam
          </p>
          <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
            Each one built to its own format
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            These are different exams, not one quiz with the names swapped. Section lengths,
            timings, whether you can skip, and whether the questions adapt to you all follow the
            exam being practised.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
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
                      <span className="rounded-full bg-panel-hover px-2 py-0.5 text-[11px] font-medium text-muted">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{exam.description}</p>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-line py-4 text-center">
                <div>
                  <dd className="text-lg font-semibold text-foreground">{exam.sections.length}</dd>
                  <dt className="text-xs text-muted">sections</dt>
                </div>
                <div>
                  <dd className="text-lg font-semibold text-foreground">{totalQuestions(exam)}</dd>
                  <dt className="text-xs text-muted">questions</dt>
                </div>
                <div>
                  <dd className="text-lg font-semibold text-foreground">{totalMinutes(exam)} min</dd>
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
                className="mt-6 flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition hover:opacity-90"
                style={{ backgroundColor: exam.theme.accent, color: exam.theme.accentForeground }}
              >
                {exam.available
                  ? `Practise the ${exam.shortLabel}`
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
      ? `Every section is ${[...sectionMinutes][0]} minutes on its own clock`
      : "Each section runs its own independent clock"
  );

  lines.push(
    exam.rules.adaptive
      ? "Questions get harder as you get them right, and easier when you slip"
      : "A fresh random set drawn from the bank on every attempt"
  );

  if (!exam.rules.allowSkip) {
    lines.push("No skipping: answer each question before the next one appears");
  }
  if (exam.rules.reviewEdit) {
    lines.push(
      `Flag as you go, then change up to ${exam.rules.reviewEdit.maxChanges} answers if time is left`
    );
  }
  if (exam.rules.sectionOrder === "chooseable") {
    lines.push("Take the sections in whatever order you like");
  }
  if (exam.scoring.kind === "scaled") {
    lines.push(`Scored ${exam.scoring.min} to ${exam.scoring.max}, weighted by difficulty`);
  }

  lines.push(
    bank > 0
      ? `${bank.toLocaleString("en-US")} questions in the bank so far`
      : "Question bank still being written"
  );
  return lines;
}

/* ---------------------------------------------------------- how it works -- */

const STEPS = [
  {
    title: "Pick an exam, then a section",
    body: "Each section starts its own clock the moment you open it and locks the others until you submit, exactly like the real sitting.",
  },
  {
    title: "Answer under time",
    body: "A live countdown and a pause button for when life interrupts. Run out of time and the section closes itself out and scores what you had.",
  },
  {
    title: "Read why you were wrong",
    body: "You get a score, a per-topic breakdown, and every question again with the correct answer marked and the reasoning spelled out. That part is the actual studying.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 border-b border-line bg-panel">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-widest text-accent-text uppercase">
            How it works
          </p>
          <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
            Three steps, and none of them is creating an account
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
    eyebrow: "Built to the real format",
    title: "The pressure is the point",
    body: "Question counts and time limits are taken from each exam's published structure, not rounded off for convenience. Sections lock while you are inside one, the countdown keeps running if you wander off to another tab, and pausing is a deliberate act you can see on screen. Practising without the clock teaches you the material but not the exam.",
    points: [
      "A per-section countdown that survives a reload",
      "Pause blurs the questions, so a break is a real break",
      "Auto-submits and scores honestly when time is up",
    ],
  },
  {
    eyebrow: "Written, not generated",
    title: "Every answer comes with its reasoning",
    body: "The banks are composed by hand and kept under version control, so an explanation is the author's reasoning rather than a language model improvising at request time. Wrong options are written to be genuinely tempting: the job of a distractor is to catch a real misunderstanding, not to be obviously silly.",
    points: [
      "A full written explanation on every question",
      "Answer position and answer length both balanced, so pattern-guessing fails",
      "A per-topic breakdown showing where you actually lost points",
    ],
  },
  {
    eyebrow: "One engine, honest to each exam",
    title: "An adaptive exam actually adapts",
    body: "Where an exam is computer-adaptive, the practice is too: questions come one at a time, they get harder while you are getting them right, and the score weighs how hard the ones you answered actually were. Where an exam is a fixed paper, you get the whole section at once and can skip and come back. Neither is a reskin of the other.",
    points: [
      "Difficulty that responds to your streak, not a fixed shuffle",
      "Scoring that reflects question difficulty, not just the count",
      "Exam-specific rules on skipping, flagging, and revisiting answers",
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
              <p className="text-xs font-semibold tracking-widest text-accent-text uppercase">
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
      a: "Yes, and there is nothing to sign up for. Open a section and start. Accounts and saved attempt history are on the roadmap, but practising here is not what you would ever be paying for.",
    },
    {
      q: "Are these real exam questions?",
      a: `No, and they legally could not be. All ${totalBank.toLocaleString(
        "en-US"
      )} questions are written originally for this site and calibrated against each exam's published structure, so the topic mix, difficulty spread, and phrasing match what you will sit. Anyone selling you leaked questions is selling you a problem.`,
    },
    {
      q: "Which exams can I practise?",
      a: `${
        examCount === 1 ? "One exam is" : `${examCount} exams are`
      } live right now, each built to its own published format rather than sharing one generic quiz. More can be added without changing how the existing ones behave.`,
    },
    {
      q: "Does my progress save?",
      a: "Within a browser tab, yes. Your answers and your remaining time survive a reload and moving between pages, so a stray refresh does not cost you the attempt. Closing the tab clears everything, which is deliberate: coming back days later to a half-spent clock is worse than starting clean.",
    },
    {
      q: "Can I retake a section?",
      a: "As many times as you like. Every attempt draws a different set, so a retake is a genuinely new paper rather than the same one again.",
    },
    {
      q: "What happens if I run out of time?",
      a: "The section submits itself, scores what you had answered, and tells you plainly that time ran out. You still get the full review with explanations for every question, including the ones you never reached. On an adaptive exam the unanswered ones cost more than wrong ones would, which is exactly how the real test behaves.",
    },
    {
      q: "Does it work on a phone?",
      a: "Yes. The question navigator moves into a bottom sheet on small screens and everything stays tappable. A long reading passage is still easier on a bigger screen, but nothing is out of reach.",
    },
  ];
}

function Faq({ faqs }: { faqs: FaqEntry[] }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:py-20">
        <p className="text-xs font-semibold tracking-widest text-accent-text uppercase">
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
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground marker:content-none">
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
        <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
          The first timed section is the one that tells you the truth
        </h2>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted">
          Give it one sitting now, find out where you actually stand, and let the explanations do
          the rest.
        </p>
        <Link
          href="#exams"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-accent px-8 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
        >
          Choose your exam
        </Link>
        <p className="mt-4 text-xs text-muted">
          Free, and no account needed. {SITE_NAME} is an independent study tool.
        </p>
      </div>
    </section>
  );
}
