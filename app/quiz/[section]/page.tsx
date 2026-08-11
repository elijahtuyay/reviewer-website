"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SECTIONS, getSectionConfig } from "@/lib/exam-config";
import { drawRandomQuestionIds, getQuestionsByIds } from "@/lib/data/questions";
import { scoreAttempt } from "@/lib/scoring";
import { SectionId } from "@/data/schema";
import { getStoredProgress, saveStoredProgress } from "@/lib/local-progress";
import Timer from "@/components/Timer";
import QuestionCard from "@/components/QuestionCard";
import ResultSummary from "@/components/ResultSummary";
import ProgressTracker from "@/components/ProgressTracker";
import SectionNav from "@/components/SectionNav";

type Phase = "taking" | "review";

export default function QuizPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: sectionParam } = use(params);

  const isValidSection = SECTIONS.some((s) => s.id === sectionParam);
  if (!isValidSection) {
    notFound();
  }
  const section = sectionParam as SectionId;

  const sectionConfig = getSectionConfig(section);

  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [phase, setPhase] = useState<Phase>("taking");
  const [hydrated, setHydrated] = useState(false);

  const questions = useMemo(() => getQuestionsByIds(section, questionIds), [section, questionIds]);

  // Resume any previously saved question set/progress for this section on mount,
  // or draw a fresh random subset from the full bank if none exists yet.
  useEffect(() => {
    const stored = getStoredProgress(section);
    const ids =
      stored.questionIds && stored.questionIds.length > 0
        ? stored.questionIds
        : drawRandomQuestionIds(section, sectionConfig.questionCount);
    setQuestionIds(ids);
    setAnswers(stored.answers);
    setPhase(stored.submitted ? "review" : "taking");
    setHydrated(true);
    if (!stored.questionIds || stored.questionIds.length === 0) {
      saveStoredProgress(section, { answers: stored.answers, submitted: stored.submitted, questionIds: ids });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  const answeredCount = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  const answeredNumbers = questions
    .map((q, i) => (answers[q.id] !== null && answers[q.id] !== undefined ? i + 1 : null))
    .filter((n): n is number => n !== null);

  function persist(nextAnswers: Record<string, number | null>, submitted: boolean) {
    const cleaned: Record<string, number> = {};
    for (const [id, value] of Object.entries(nextAnswers)) {
      if (value !== null && value !== undefined) cleaned[id] = value;
    }
    saveStoredProgress(section, { answers: cleaned, submitted, questionIds });
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
  }

  const result = useMemo(() => {
    if (phase !== "review") return null;
    const answerList = questions.map((q) => ({
      questionId: q.id,
      selectedIndex: answers[q.id] ?? null,
    }));
    return scoreAttempt(questions, answerList);
  }, [phase, questions, answers]);

  if (!hydrated) return null;

  return (
    <div className="flex flex-1 justify-center bg-background">
      <div className="w-full max-w-6xl px-6 py-10 sm:py-16">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <Link href="/nmat" className="text-sm text-muted hover:text-foreground">
              ← Exam setup
            </Link>
            <h1 className="mt-1 text-xl font-semibold text-foreground">{sectionConfig.label}</h1>
          </div>
          {phase === "taking" ? (
            <div className="text-right">
              <Timer minutes={sectionConfig.minutes} onExpire={handleSubmit} />
              <p className="mt-1 text-xs text-muted">
                {answeredCount}/{questions.length} answered
              </p>
            </div>
          ) : (
            <Link
              href="/"
              className="rounded-md border border-line px-3 py-1.5 text-sm text-foreground hover:bg-panel-hover"
            >
              Done
            </Link>
          )}
        </div>

        <div className="mt-4 flex gap-8">
          <aside className="hidden w-56 shrink-0 flex-col gap-6 lg:flex">
            <div className="sticky top-6 flex flex-col gap-6">
              <SectionNav
                currentSection={section}
                currentAnsweredCount={answeredCount}
                locked={phase === "taking"}
              />
              {phase === "taking" && (
                <ProgressTracker
                  totalQuestions={questions.length}
                  answeredNumbers={answeredNumbers}
                  onJump={handleJump}
                />
              )}
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
                  className="w-full rounded-md bg-foreground py-2.5 text-sm font-medium text-background hover:opacity-90"
                >
                  Submit ({answeredCount}/{questions.length} answered)
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
