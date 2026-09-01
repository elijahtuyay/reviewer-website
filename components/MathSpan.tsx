"use client";

import { InlineMath } from "react-katex";
// Imported HERE rather than in the root layout so the stylesheet and its 20
// @font-face declarations travel with this chunk instead of loading on all
// eleven routes, including the five that render no math at all.
import "katex/dist/katex.min.css";

/**
 * One rendered math span. Split into its own module purely so `react-katex` and
 * `katex` can be code-split away from everything else.
 *
 * Measured before the split: the katex + react-katex chunk is 310 KB raw /
 * 88.6 KB gzipped and was loaded on all six quiz routes — 35% of the quiz
 * route's First Load JS. Two of those six sections contain literally zero math
 * spans (NMAT Language Skills, 0 of 100 questions; GMAT Verbal, 0 of 30), so
 * they downloaded all of it and could never use a byte.
 *
 * See MathText for the loading strategy and why the pop-in this could cause
 * does not happen in practice.
 */
export default function MathSpan({ math }: { math: string }) {
  return <InlineMath math={math} />;
}
