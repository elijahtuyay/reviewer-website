import { Difficulty } from "@/data/schema";
import { ScoreResult } from "@/lib/scoring";
import { ExamModule } from "@/lib/exams/types";

interface ResultSummaryProps {
  result: ScoreResult;
  sectionLabel: string;
  exam: ExamModule;
}

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

/**
 * The scored header. Reads the exam's scoring model rather than assuming raw
 * points, so a scaled band score and a marks total both render honestly, and
 * neither pretends to be the other.
 */
export default function ResultSummary({ result, sectionLabel, exam }: ResultSummaryProps) {
  const percent =
    result.totalQuestions > 0
      ? Math.round((result.correctCount / result.totalQuestions) * 100)
      : 0;
  const scaled = result.kind === "scaled";

  // The topic rows only include questions that were served. On a free-form
  // section that is always the whole section; on an adaptive one it is not.
  const servedTotal = result.byTopic.reduce((sum, t) => sum + t.total, 0);

  return (
    <div className="border-b border-line pb-8">
      <p className="text-sm font-medium tracking-wide text-muted uppercase">
        {sectionLabel}: Results
      </p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-4xl font-semibold text-foreground">{result.score}</span>
        {/* The denominator is the point: a bare number gives no sense of
            whether it is a disaster or a good run. */}
        <span className="text-xl text-muted">
          {scaled ? `of ${result.minScore}–${result.maxScore}` : `/ ${result.maxScore}`}
        </span>
        <span className="text-muted">{scaled ? "scaled" : "points"}</span>
      </div>

      <p className="mt-1 text-sm text-muted">
        {result.correctCount} of {result.totalQuestions} correct ({percent}%)
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span>{result.correctCount} correct</span>
        <span>{result.incorrectCount} incorrect</span>
        <span>{result.unansweredCount} unanswered</span>
      </div>

      {/* On an adaptive section the difficulty mix IS the story: it shows how
          far the exam let you climb, which a raw tally cannot. */}
      {exam.rules.adaptive && (
        <div className="mt-6 rounded-lg border border-line bg-panel p-4">
          <p className="text-sm font-medium text-foreground">The difficulty you reached</p>
          <div className="mt-3 flex flex-col gap-2">
            {DIFFICULTY_ORDER.map((level) => {
              const total = result.served[level];
              if (total === 0) return null;
              const correct = result.correctByDifficulty[level];
              return (
                <div key={level} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted capitalize">{level}</span>
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="h-1.5 w-24 overflow-hidden rounded-full bg-panel-hover sm:w-40"
                    >
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${(correct / total) * 100}%` }}
                      />
                    </span>
                    <span className="font-mono text-muted">
                      {correct}/{total}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          {/* Two messages, because the honest one depends on what happened. A
              seed-sized bank can be exhausted at the hard rung by a strong
              candidate, who is then served easier questions because nothing
              harder is left. Telling that person the ladder reflects the exam's
              estimate of them would be a lie about their own result. */}
          <p className="mt-3 text-xs text-muted">
            {result.served.hard > 0 && result.correctByDifficulty.hard === result.served.hard
              ? "The section started at medium difficulty and followed your answers. You answered every hard question correctly. The bank then had no harder question left, so the later questions were easier. That is not a lower estimate of your level."
              : "The section started at medium difficulty and followed your answers. More hard questions mean a higher estimate of your level."}
          </p>
        </div>
      )}

      <div className="mt-6">
        <p className="text-sm font-medium text-foreground">Results by topic</p>
        {/* On an adaptive section the ladder stops where the clock did, so these
            rows cover only what was actually served and will not add up to the
            total in the summary above. Both numbers are correct; presenting them
            side by side without saying so is what makes them look contradictory. */}
        {servedTotal < result.totalQuestions && (
          <p className="mt-1 text-xs text-muted">
            This covers the {servedTotal} question{servedTotal === 1 ? "" : "s"} the exam gave you.
            You did not reach {result.totalQuestions - servedTotal} of {result.totalQuestions}.
          </p>
        )}
        <div className="mt-2 flex flex-col gap-1.5">
          {result.byTopic.map((t) => (
            <div key={t.topic} className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted">{t.topic}</span>
              {/* Skipped is called out rather than folded into the denominator.
                  "Error Identification 0/8" read as a failed topic to a user who
                  had simply never reached those eight questions, which is the
                  wrong thing to tell someone deciding whether to trust the
                  product. The summary above already separates the three
                  outcomes; this row now agrees with it. */}
              <span className="flex shrink-0 items-center gap-2 font-mono text-muted">
                <span>
                  {t.correct}/{t.total}
                </span>
                {t.unanswered > 0 && (
                  <span className="font-sans text-xs">
                    ({t.unanswered} with no answer)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Said plainly, because the obvious next question is "what does this mean
          for my actual exam", and the honest answer is "nothing directly". */}
      <p className="mt-6 text-xs text-muted">
        {scaled
          ? `This is a practice estimate on the ${exam.shortLabel} scale. It includes question difficulty, and it reduces the score for every unanswered question. It is a model of the real exam. It is not an official ${exam.shortLabel} score, and it does not predict one.`
          : `This is a raw practice score for this section only. It is not an official ${exam.shortLabel} score or percentile, and it does not predict one.`}
      </p>
    </div>
  );
}
