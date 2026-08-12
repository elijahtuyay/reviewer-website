import { ScoreResult } from "@/lib/scoring";

interface ResultSummaryProps {
  result: ScoreResult;
  sectionLabel: string;
}

export default function ResultSummary({ result, sectionLabel }: ResultSummaryProps) {
  return (
    <div className="border-b border-line pb-8">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        {sectionLabel}: Results
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-semibold text-foreground">{result.score}</span>
        <span className="text-muted">points</span>
      </div>
      <div className="mt-2 flex gap-4 text-sm text-muted">
        <span>{result.correctCount} correct</span>
        <span>{result.incorrectCount} incorrect</span>
        <span>{result.unansweredCount} unanswered</span>
        <span>of {result.totalQuestions}</span>
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium text-foreground">By topic</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {result.byTopic.map((t) => (
            <div key={t.topic} className="flex items-center justify-between text-sm">
              <span className="text-muted">{t.topic}</span>
              <span className="font-mono text-muted">
                {t.correct}/{t.total}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
