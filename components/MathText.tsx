"use client";

import { Component, Fragment, Suspense, lazy, type ReactNode } from "react";

/**
 * KaTeX is loaded only by the sections that actually contain math.
 *
 * `React.lazy` here rather than `next/dynamic`, and the difference matters:
 * `next/dynamic` renders its own Suspense boundary internally, so its `loading`
 * option is the only fallback that can ever show — and `loading` receives no
 * props, meaning it cannot render the specific formula that is pending. It can
 * only render nothing. With a plain lazy component the boundary is ours, one per
 * span, so the fallback can show the LaTeX source of that exact span.
 *
 * That is not a stylistic preference. With a null fallback,
 * "If $2x + 5 = 17$, what is $x$?" paints as "If , what is ?" above its options
 * for the length of a cold chunk fetch, and a fast reader can answer a question
 * with the equation missing from it.
 *
 * No SSR concern: the question banks are themselves dynamically imported on the
 * client, so no question text is ever server-rendered and this never mounts
 * during SSR.
 */
const LazyMathSpan = lazy(() => import("@/components/MathSpan"));

/**
 * Falls back to the raw LaTeX if the KaTeX chunk fails to load.
 *
 * Suspense catches the pending state; it does NOT catch a rejected import, and
 * `next/dynamic`'s loadable does not add an error boundary either. Without this,
 * a chunk fetch that fails mid-attempt — a redeploy rotating chunk filenames
 * while a candidate is thirty minutes into a section is the realistic case —
 * throws to the route error boundary and destroys the attempt while the clock
 * keeps running. Before the code-split this class of failure could only happen
 * at page load, because react-katex was a static import.
 */
class MathBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface MathTextProps {
  text: string;
  className?: string;
}

/** True when a string contains at least one `$...$` math span. */
export function hasMath(text: string): boolean {
  return /\$[^$]+\$/.test(text);
}

/**
 * True when any part of a question needs KaTeX.
 *
 * The explanation counts, and it is the reason this is not just the prompt.
 * Logical Reasoning has math in exactly ONE of 100 prompts but 29 explanations,
 * so the whole section's preload hangs on a single question, and Language
 * Skills is skipped only because it happens to have no explanation math either.
 * Adding one formula to any Language Skills explanation would silently stop the
 * preload for that section.
 *
 * Explanations no longer ship with the questions, so this reads the
 * `explanationHasMath` flag that `scripts/split-bank.mjs` computes in their
 * place. A boolean survives the split; the prose does not need to.
 */
export function questionNeedsMath(question: {
  prompt: string;
  explanationHasMath?: boolean;
  // Optional since the GRE brought numeric-entry questions, which have no
  // options at all. A required array here would have made the preloader the
  // one thing standing between a new question kind and a compile.
  options?: string[];
}): boolean {
  return (
    hasMath(question.prompt) ||
    question.explanationHasMath === true ||
    (question.options ?? []).some(hasMath)
  );
}

/**
 * Starts downloading the KaTeX chunk without rendering anything.
 *
 * Called once per section, from `useAttempt`, after the bank resolves and only
 * when the drawn questions actually contain math. Without it the chunk is not
 * requested until the first math span renders, which is a round trip the user
 * waits through mid-question; with it the fetch overlaps the time they spend
 * reading question one.
 */
export function preloadMath() {
  void import("@/components/MathSpan");
}

/**
 * Renders text that may contain inline LaTeX math delimited by single dollar
 * signs (e.g. "If $x^2 = 9$, what is x?") using KaTeX, while turning literal
 * newlines into real line breaks — used for both math notation and for
 * structured list/table-style prompts that separate rows with "\n".
 */
export default function MathText({ text, className }: MathTextProps) {
  const lines = text.split("\n");

  return (
    <span className={className}>
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {renderLineWithMath(line)}
        </Fragment>
      ))}
    </span>
  );
}

function renderLineWithMath(line: string) {
  const parts = line.split(/(\$[^$]+\$)/g);
  return parts.map((part, i) => {
    if (part.length > 2 && part.startsWith("$") && part.endsWith("$")) {
      // `\displaystyle` rather than KaTeX's default inline (text) style.
      //
      // In text style a fraction is typeset at script size: on an answer button
      // the numerals land tiny with sub-pixel gaps above and below the rule,
      // which reads as the denominator touching the fraction bar. Display style
      // typesets numerator and denominator at full size with the proper rule
      // gap, which is what makes fractions legible in an option.
      //
      // Applied here, once, instead of in the question bank: it is a rendering
      // decision, so it belongs in the renderer. Putting `\displaystyle` in the
      // JSON would mean repeating it across hundreds of questions and relying on
      // every future author to remember it.
      //
      // It was applied to EVERY span originally, on the assumption that it is a
      // no-op for math without stacked parts. It is not: display style also
      // typesets a superscript nearly as large as its base, so `$x^2$` rendered
      // with the exponent swollen and riding up into the line above. Only spans
      // that actually stack something get it now.
      const body = part.slice(1, -1);
      const stacks =
        body.includes("\\frac") || body.includes("\\dfrac") || body.includes("\\binom");
      // The raw source is the fallback for both "still loading" and "failed to
      // load", so the term is never simply absent from the question.
      const raw = <span>{body}</span>;
      return (
        <MathBoundary key={i} fallback={raw}>
          <Suspense fallback={raw}>
            <LazyMathSpan math={stacks ? `\\displaystyle ${body}` : body} />
          </Suspense>
        </MathBoundary>
      );
    }
    return part ? <Fragment key={i}>{part}</Fragment> : null;
  });
}
