import { Fragment } from "react";
import { InlineMath } from "react-katex";

interface MathTextProps {
  text: string;
  className?: string;
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
      // In text style a fraction is typeset at script size: on a 14px answer
      // button the numerals land around 8px with sub-pixel gaps above and below
      // the rule, which reads as the denominator touching the fraction bar.
      // Display style typesets numerator and denominator at full size with the
      // proper rule gap, which is what makes fractions legible in an option.
      //
      // Applied here, once, instead of in the question bank: it is a rendering
      // decision, so it belongs in the renderer. Putting `\displaystyle` in the
      // JSON would mean repeating it across hundreds of questions and relying on
      // every future author to remember it. It is a no-op for math without
      // stacked parts (`$x^2$`, `$5:6$`), so applying it uniformly is safe.
      return <InlineMath key={i} math={`\\displaystyle ${part.slice(1, -1)}`} />;
    }
    return part ? <Fragment key={i}>{part}</Fragment> : null;
  });
}
