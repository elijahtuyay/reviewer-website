import Link from "next/link";
import type { Metadata } from "next";
import { EXAMS, ExamConfig, getExamConfig } from "@/lib/exam-config";
import { AFFILIATION_DISCLAIMER, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { getQuestionsForSection } from "@/lib/data/questions";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

/**
 * The home page is the product's front door, not a router. It has to answer
 * "what is this, is it any good, and why would I trust it" before it offers a
 * link anywhere, which is why the section list now sits below a pitch rather
 * than being the whole page as it used to be.
 *
 * The featured exam is the one with a real question bank. Every number on this
 * page is derived from EXAMS and from the bank itself rather than typed in, so
 * adding GMAT content later fills these in instead of dating them.
 */
const FEATURED_EXAM_ID = "nmat" as const;

export default function Home() {
  const featured = getExamConfig(FEATURED_EXAM_ID);
  const otherExams = Object.values(EXAMS).filter((exam) => exam.id !== featured.id);

  const perAttemptQuestions = featured.sections.reduce((sum, s) => sum + s.questionCount, 0);
  const bankSize = featured.sections.reduce(
    (sum, s) => sum + getQuestionsForSection(featured.id, s.id).length,
    0
  );
  const totalMinutes = featured.sections.reduce((sum, s) => sum + s.minutes, 0);
  const shortestSectionMinutes = Math.min(...featured.sections.map((s) => s.minutes));
  const faqs = buildFaqs(featured.shortLabel, bankSize);

  /**
   * Structured data, emitted as a plain <script type="application/ld+json">.
   * This is the one place dangerouslySetInnerHTML is warranted: the payload is
   * built from our own constants, never from user input. JSON.stringify does
   * not escape "<", though, so a future exam label or a NEXT_PUBLIC_SITE_URL
   * containing "</script>" would break out of the tag. Escaping it below costs
   * nothing and removes the need for anyone to keep that invariant in mind.
   */
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
      {
        "@type": "Course",
        "@id": `${SITE_URL}/${featured.id}#course`,
        name: `${featured.label} practice exam`,
        description: `Free timed ${featured.shortLabel} practice covering ${featured.sections
          .map((s) => s.label)
          .join(", ")}, with a written explanation for every answer.`,
        url: `${SITE_URL}/${featured.id}`,
        isAccessibleForFree: true,
        provider: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
        disclaimer: AFFILIATION_DISCLAIMER,
      },
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\u003c"),
        }}
      />
      <Hero
        examLabel={featured.label}
        examShortLabel={featured.shortLabel}
        bankSize={bankSize}
        perAttemptQuestions={perAttemptQuestions}
        sectionCount={featured.sections.length}
      />

      <StatBand
        stats={[
          { value: bankSize.toLocaleString("en-US"), label: "questions written by hand" },
          { value: String(perAttemptQuestions), label: "drawn fresh per full attempt" },
          { value: `${totalMinutes} min`, label: "of timed practice" },
          { value: "Free", label: "no account, no card" },
        ]}
      />

      <SectionPicker exam={featured} />

      <HowItWorks />

      <FeatureBands />

      <OtherExams exams={otherExams} />

      <Faq faqs={faqs} />

      <ClosingCta minutes={shortestSectionMinutes} />
    </div>
  );
}

/* ------------------------------------------------------------------ hero -- */

function Hero({
  examLabel,
  examShortLabel,
  bankSize,
  perAttemptQuestions,
  sectionCount,
}: {
  examLabel: string;
  examShortLabel: string;
  bankSize: number;
  perAttemptQuestions: number;
  sectionCount: number;
}) {
  return (
    // The one saturated surface on the site. Accent on accent-foreground rather
    // than a light/dark pair, so it reads identically in both themes instead of
    // needing a second palette maintained alongside the first.
    <section className="relative overflow-hidden bg-accent text-accent-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-black/0 via-black/10 to-black/30"
      />
      <div className="relative mx-auto w-full max-w-5xl px-6 py-20 text-center sm:py-28">
        <p className="text-xs font-semibold tracking-widest uppercase opacity-80">
          {examLabel} practice
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-3xl leading-tight font-bold sm:text-4xl md:text-5xl">
          Walk into the {examShortLabel} already knowing what it feels like.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed opacity-90 sm:text-lg">
          {sectionCount} independently-timed sections, {perAttemptQuestions} questions drawn fresh
          from a bank of {bankSize}, and a written explanation waiting behind every single answer.
          No sign-up, no paywall, no model guessing at the answer key.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="#sections"
            className="flex min-h-12 w-full items-center justify-center rounded-lg bg-accent-foreground px-7 text-sm font-semibold text-accent transition hover:opacity-90 sm:w-auto"
          >
            Start a practice section
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
      <dl className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-y-8 px-6 py-10 sm:grid-cols-4">
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

/* -------------------------------------------------------------- sections -- */

/** Keyed by section id, with a neutral fallback so a newly added section never renders a blank tile. */
function SectionIcon({ sectionId }: { sectionId: string }) {
  const common = {
    className: "h-6 w-6",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (sectionId === "language-skills") {
    // An open book: two facing pages.
    return (
      <svg {...common}>
        <path d="M12 6.5C10.5 5 8.5 4.5 4.5 4.5v13c4 0 6 .5 7.5 2 1.5-1.5 3.5-2 7.5-2v-13c-4 0-6 .5-7.5 2Z" />
        <path d="M12 6.5v13" />
      </svg>
    );
  }
  if (sectionId === "quantitative-skills") {
    // A calculator keypad.
    return (
      <svg {...common}>
        <rect x="4" y="3" width="16" height="18" rx="2.5" />
        <path d="M7.5 7h9M8 11.5h.01M12 11.5h.01M16 11.5h.01M8 15.5h.01M12 15.5h.01M16 15.5h.01M8 18.5h.01M12 18.5h.01M16 18.5h.01" />
      </svg>
    );
  }
  if (sectionId === "logical-reasoning") {
    // A branching decision tree.
    return (
      <svg {...common}>
        <circle cx="12" cy="5" r="2.25" />
        <circle cx="6" cy="19" r="2.25" />
        <circle cx="18" cy="19" r="2.25" />
        <path d="M12 7.25v3.25a2 2 0 0 1-.6 1.45L7.4 15.6M12 7.25v3.25a2 2 0 0 0 .6 1.45l4 3.65" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2.5" />
    </svg>
  );
}

function SectionPicker({ exam }: { exam: ExamConfig }) {
  return (
    // A little scroll margin so the "Start a practice section" anchor lands
    // with breathing room above the heading rather than flush to the viewport
    // edge. (SiteHeader is not sticky, so there is nothing to clear.)
    <section id="sections" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-widest text-accent-text uppercase">
            Pick where to start
          </p>
          <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
            Three sections, each timed on its own
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            Sections do not share a clock, and you can only be inside one at a time. Take them one
            evening at a stretch, or all three back to back as a full mock.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {exam.sections.map((section) => (
            <article
              key={section.id}
              className="flex flex-col rounded-xl border border-line bg-panel p-6 transition-colors hover:border-line-strong"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/10 text-accent-text dark:bg-accent/20">
                <SectionIcon sectionId={section.id} />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{section.label}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{section.description}</p>
              <p className="mt-4 text-xs font-medium text-muted">
                {section.questionCount} questions, {section.minutes} minutes
              </p>
              <Link
                href={`/${exam.id}/quiz/${section.id}`}
                className="mt-5 flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
              >
                Start {section.label}
              </Link>
            </article>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted">
          Want the scoring rules and the full format first?{" "}
          <Link
            href={`/${exam.id}`}
            className="font-medium text-foreground underline underline-offset-2"
          >
            Read the {exam.shortLabel} exam format page
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- how it works -- */

const STEPS = [
  {
    title: "Pick a section",
    body: "Language Skills, Quantitative Skills, or Logical Reasoning. Each one starts its own clock the moment you open it, exactly like the real sitting.",
  },
  {
    title: "Answer under time",
    body: "A live countdown, a jump-to-question grid, and a pause button for when life interrupts. Run out of time and the section closes itself out and scores what you had.",
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
          <p className="text-xs font-semibold tracking-widest text-accent-text uppercase">How it works</p>
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
    body: "Question counts and time limits are taken from the exam's published structure, not rounded off for convenience. Sections lock while you are inside one, the countdown keeps running if you wander off to another tab, and pausing is a deliberate act you can see on screen. Practising without the clock teaches you the material but not the exam.",
    points: [
      "A per-section countdown that survives a reload",
      "Pause blurs the questions, so a break is a real break",
      "Auto-submits and scores honestly when time is up",
    ],
  },
  {
    eyebrow: "Written, not generated",
    title: "Every answer comes with its reasoning",
    body: "The bank is composed by hand and kept under version control, so an explanation is the author's reasoning rather than a language model improvising at request time. Wrong options are written to be genuinely tempting: the job of a distractor is to catch a real misunderstanding, not to be obviously silly.",
    points: [
      "A full written explanation on every question",
      "Correct-answer position shuffled, so pattern-guessing fails",
      "A per-topic breakdown showing where you actually lost points",
    ],
  },
  {
    eyebrow: "Different every time",
    title: "You cannot memorise your way through it",
    body: "Each attempt draws a random subset from the full bank and spreads the topics out, so you never get six of the same kind in a row. Retake a section tomorrow and it is a different paper, which is what makes a second score mean something.",
    points: [
      "A randomised draw from the full bank on every attempt",
      "Topics interleaved instead of arriving in blocks",
      "Retake any section as many times as you want",
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

/* ---------------------------------------------------------- other exams -- */

function OtherExams({ exams }: { exams: ExamConfig[] }) {
  if (exams.length === 0) return null;

  return (
    <section className="border-b border-line bg-panel">
      <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-widest text-accent-text uppercase">More exams</p>
          <h2 className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">
            What is being built next
          </h2>
          <p className="mt-3 leading-relaxed text-muted">
            The engine is exam-agnostic, so a new exam is a question bank away. These already have
            their format mapped out and are waiting on content.
          </p>
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {exams.map((exam) => (
            <article
              key={exam.id}
              className="rounded-xl border border-dashed border-line-strong p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground">{exam.label}</h3>
                <span className="shrink-0 rounded-full bg-panel-hover px-2.5 py-1 text-[11px] font-medium text-muted">
                  {exam.available ? "Available" : "Coming soon"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {exam.sections.map((s) => s.label).join(", ")}
              </p>
              <Link
                href={`/${exam.id}`}
                className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-foreground underline underline-offset-2"
              >
                See the {exam.shortLabel} format
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- faq -- */

interface FaqEntry {
  q: string;
  a: string;
}

/**
 * Built once and used twice: for the rendered accordion and for the FAQPage
 * structured data in the same page. Keeping one source means a search result
 * can never quote an answer the page no longer gives.
 */
function buildFaqs(examShortLabel: string, bankSize: number): FaqEntry[] {
  return [
    {
      q: "Is it really free?",
      a: `Yes, and there is nothing to sign up for. Open a section and start. Accounts and saved attempt history are on the roadmap, but practising the ${examShortLabel} here is not what you would ever be paying for.`,
    },
    {
      q: "Are these real exam questions?",
      a: `No, and they legally could not be. All ${bankSize.toLocaleString(
        "en-US"
      )} questions are written originally for this site and calibrated against the published exam structure, so the topic mix, difficulty spread, and phrasing match what you will sit. Anyone selling you leaked questions is selling you a problem.`,
    },
    {
      q: "Does my progress save?",
      a: "Within a browser tab, yes. Your answers and your remaining time survive a reload and moving between pages, so a stray refresh does not cost you the attempt. Closing the tab clears everything, which is deliberate: coming back days later to a half-spent clock is worse than starting clean.",
    },
    {
      q: "Can I retake a section?",
      a: "As many times as you like. Every attempt draws a different random set from the bank, so a retake is a genuinely new paper rather than the same one again.",
    },
    {
      q: "What happens if I run out of time?",
      a: "The section submits itself, scores what you had answered, and tells you plainly that time ran out. You still get the full review with explanations for every question, including the ones you never reached.",
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

function ClosingCta({ minutes }: { minutes: number }) {
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
          Give it {minutes} minutes now, find out where you actually stand, and let the explanations
          do the rest.
        </p>
        <Link
          href="#sections"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-accent px-8 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
        >
          Choose a section
        </Link>
        <p className="mt-4 text-xs text-muted">
          Free, and no account needed. {SITE_NAME} is an independent study tool.
        </p>
      </div>
    </section>
  );
}
