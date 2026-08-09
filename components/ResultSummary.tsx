import { ScoreResult } from "@/lib/scoring";

interface ResultSummaryProps {
  result: ScoreResult;
  sectionLabel: string;
}

export default function ResultSummary({ result, sectionLabel }: ResultSummaryProps) {
  return (
    <div className="border-b border-neutral-200 pb-8">
      <p className="text-sm font-medium tracking-wide text-neutral-500 uppercase">
        {sectionLabel} — Results
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-semibold text-neutral-900">{result.score}</span>
        <span className="text-neutral-500">points</span>
      </div>
      <div className="mt-2 flex gap-4 text-sm text-neutral-600">
        <span>{result.correctCount} correct</span>
        <span>{result.incorrectCount} incorrect</span>
        <span>{result.unansweredCount} unanswered</span>
        <span>of {result.totalQuestions}</span>
      </div>

      <div className="mt-6">
        <p className="text-sm font-medium text-neutral-700">By topic</p>
        <div className="mt-2 flex flex-col gap-1.5">
          {result.byTopic.map((t) => (
            <div key={t.topic} className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">{t.topic}</span>
              <span className="font-mono text-neutral-500">
                {t.correct}/{t.total}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
