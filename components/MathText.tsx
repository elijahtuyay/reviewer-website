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
      return <InlineMath key={i} math={part.slice(1, -1)} />;
    }
    return part ? <Fragment key={i}>{part}</Fragment> : null;
  });
}
