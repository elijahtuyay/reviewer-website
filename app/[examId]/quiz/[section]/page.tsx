"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getExamConfig, getSectionConfig, isValidExamId } from "@/lib/exam-config";
import { drawRandomQuestionIds, getQuestionsByIds } from "@/lib/data/questions";
import { scoreAttempt } from "@/lib/scoring";
import { ExamId, SectionId } from "@/data/schema";
import { getStoredProgress, saveStoredProgress } from "@/lib/local-progress";
import Timer from "@/components/Timer";
import QuestionCard from "@/components/QuestionCard";
import ResultSummary from "@/components/ResultSummary";
import ProgressTracker from "@/components/ProgressTracker";
import SectionNav from "@/components/SectionNav";
import PauseOverlay from "@/components/PauseOverlay";
import MobileNavSheet from "@/components/MobileNavSheet";

type Phase = "taking" | "review";

export default function QuizPage({ params }: { params: Promise<{ examId: string; section: string }> }) {
  const { examId: examIdParam, section: sectionParam } = use(params);

  // The parent server layout already 404s for an invalid/unavailable examId or
  // section before this client component ever renders, so these checks are a
  // type-narrowing formality, not a real gate — `notFound()` isn't a supported
  // call from a Client Component.
  const examIdValid = isValidExamId(examIdParam);
  const examId = (examIdValid ? examIdParam : "nmat") as ExamId;
  const exam = getExamConfig(examId);
  const sectionValid = exam.sections.some((s) => s.id === sectionParam);
  const section = (sectionValid ? sectionParam : exam.sections[0].id) as SectionId;

  const sectionConfig = getSectionConfig(examId, section);

  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [phase, setPhase] = useState<Phase>("taking");
  const [hydrated, setHydrated] = useState(false);
  const [paused, setPaused] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const questions = useMemo(
    () => getQuestionsByIds(examId, section, questionIds),
    [examId, section, questionIds]
  );

  // Resume any previously saved question set/progress for this section on mount,
  // or draw a fresh random subset from the full bank if none exists yet.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reads localStorage, which is unavailable during render/SSR */
    const stored = getStoredProgress(examId, section);
    const ids =
      stored.questionIds && stored.questionIds.length > 0
        ? stored.questionIds
        : drawRandomQuestionIds(examId, section, sectionConfig.questionCount);
    setQuestionIds(ids);
    setAnswers(stored.answers);
    setPhase(stored.submitted ? "review" : "taking");
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (!stored.questionIds || stored.questionIds.length === 0) {
      saveStoredProgress(examId, section, {
        answers: stored.answers,
        submitted: stored.submitted,
        questionIds: ids,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, section]);

  const answeredCount = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  const answeredNumbers = questions
    .map((q, i) => (answers[q.id] !== null && answers[q.id] !== undefined ? i + 1 : null))
    .filter((n): n is number => n !== null);
  const correctNumbers = questions
    .map((q, i) => (answers[q.id] === q.correctIndex ? i + 1 : null))
    .filter((n): n is number => n !== null);
  const incorrectNumbers = questions
    .map((q, i) =>
      answers[q.id] !== null && answers[q.id] !== undefined && answers[q.id] !== q.correctIndex ? i + 1 : null
    )
    .filter((n): n is number => n !== null);

  function persist(nextAnswers: Record<string, number | null>, submitted: boolean) {
    const cleaned: Record<string, number> = {};
    for (const [id, value] of Object.entries(nextAnswers)) {
      if (value !== null && value !== undefined) cleaned[id] = value;
    }
    saveStoredProgress(examId, section, { answers: cleaned, submitted, questionIds });
  }

  function handleSelect(questionId: string, optionIndex: number) {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: optionIndex };
      persist(next, false);
      return next;
    });
  }

  function handleSubmit() {
    persist(answers, true);
    setPhase("review");
  }

  function handleJump(questionNumber: number) {
    document.getElementById(`question-${questionNumber}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileNavOpen(false);
  }

  const result = useMemo(() => {
    if (phase !== "review") return null;
    const answerList = questions.map((q) => ({
      questionId: q.id,
      selectedIndex: answers[q.id] ?? null,
    }));
    return scoreAttempt(questions, answerList, exam.pointsPerCorrectAnswer);
  }, [phase, questions, answers, exam.pointsPerCorrectAnswer]);

  if (!examIdValid || !sectionValid || !hydrated) return null;

  return (
    <div className="flex flex-1 justify-center bg-background">
      <div
        className="w-full max-w-6xl px-6 py-10 sm:py-16"
        inert={paused || mobileNavOpen || undefined}
        aria-hidden={paused || mobileNavOpen || undefined}
      >
        <div className="sticky top-0 z-20 flex h-20 items-center justify-between gap-3 border-b border-line bg-background/95 backdrop-blur">
          <div className="min-w-0">
            <Link href={`/${examId}`} className="text-sm text-muted hover:text-foreground">
              ← Exam setup
            </Link>
            <h1 className="mt-1 truncate text-lg font-semibold text-foreground sm:text-xl">
              {sectionConfig.label}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-11 items-center justify-center rounded-md border border-line px-3 text-sm text-foreground hover:bg-panel-hover lg:hidden"
            >
              Sections
            </button>
            {phase === "taking" ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <Timer minutes={sectionConfig.minutes} onExpire={handleSubmit} paused={paused} />
                  <p className="mt-1 text-xs text-muted">
                    {answeredCount}/{questions.length} answered
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaused(true)}
                  className="flex h-11 items-center justify-center rounded-md border border-line px-3 text-sm text-foreground hover:bg-panel-hover"
                >
                  Pause
                </button>
              </div>
            ) : (
              <Link
                href="/"
                className="flex h-11 items-center justify-center rounded-md border border-line px-3 text-sm text-foreground hover:bg-panel-hover"
              >
                Done
              </Link>
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-8">
          <aside className="hidden w-56 shrink-0 flex-col gap-6 lg:flex">
            <div className="sticky top-24 flex flex-col gap-6">
              <SectionNav
                examId={examId}
                currentSection={section}
                currentAnsweredCount={answeredCount}
                locked={phase === "taking"}
                currentResult={result}
              />
              <ProgressTracker
                totalQuestions={questions.length}
                answeredNumbers={answeredNumbers}
                onJump={handleJump}
                reviewMode={phase === "review"}
                correctNumbers={correctNumbers}
                incorrectNumbers={incorrectNumbers}
              />
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            {phase === "review" && result && (
              <div className="mb-4">
                <ResultSummary result={result} sectionLabel={sectionConfig.label} />
              </div>
            )}

            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                selectedIndex={answers[question.id] ?? null}
                onSelect={(optionIndex) => handleSelect(question.id, optionIndex)}
                reviewMode={phase === "review"}
              />
            ))}

            {phase === "taking" && (
              <div className="sticky bottom-0 mt-6 border-t border-line bg-background py-4">
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full rounded-md bg-accent py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90"
                >
                  Submit ({answeredCount}/{questions.length} answered)
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      <PauseOverlay paused={paused} onResume={() => setPaused(false)} />

      <MobileNavSheet open={mobileNavOpen} onClose={() => setMobileNavOpen(false)}>
        <div className="flex flex-col gap-6">
          <SectionNav
            examId={examId}
            currentSection={section}
            currentAnsweredCount={answeredCount}
            locked={phase === "taking"}
            currentResult={result}
          />
          <ProgressTracker
            totalQuestions={questions.length}
            answeredNumbers={answeredNumbers}
            onJump={handleJump}
            reviewMode={phase === "review"}
            correctNumbers={correctNumbers}
            incorrectNumbers={incorrectNumbers}
          />
        </div>
      </MobileNavSheet>
    </div>
  );
}
