import { ScoreResult } from "@/lib/scoring";

interface ResultSummaryProps {
  result: ScoreResult;
  sectionLabel: string;
}

export default function ResultSummary({ result, sectionLabel }: ResultSummaryProps) {
  const percent =
    result.totalQuestions > 0
      ? Math.round((result.correctCount / result.totalQuestions) * 100)
      : 0;

  return (
    <div className="border-b border-line pb-8">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        {sectionLabel}: Results
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-semibold text-foreground">{result.score}</span>
        {/* The denominator is the point: "21 points" on its own gives no sense
            of whether that is a disaster or a good run. */}
        <span className="text-xl text-muted">/ {result.maxScore}</span>
        <span className="text-muted">points</span>
      </div>
      <p className="mt-1 text-sm text-muted">
        {result.correctCount} of {result.totalQuestions} correct ({percent}%)
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>{result.correctCount} correct</span>
        <span>{result.incorrectCount} incorrect</span>
        <span>{result.unansweredCount} unanswered</span>
      </div>
      {/* Said plainly, because the obvious next question is "what does this
          mean for my actual exam", and the honest answer is "nothing directly". */}
      <p className="mt-3 text-xs text-muted">
        This is a raw practice score for this section only. It is not an NMAT scaled score or
        percentile, and it does not predict one.
      </p>

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
