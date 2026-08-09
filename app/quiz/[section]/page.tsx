"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SECTIONS, getSectionConfig } from "@/lib/exam-config";
import { getQuestionsForSection } from "@/lib/data/questions";
import { scoreAttempt } from "@/lib/scoring";
import { SectionId } from "@/data/schema";
import Timer from "@/components/Timer";
import QuestionCard from "@/components/QuestionCard";
import ResultSummary from "@/components/ResultSummary";

type Phase = "taking" | "review";

export default function QuizPage({ params }: { params: Promise<{ section: string }> }) {
  const { section: sectionParam } = use(params);

  const isValidSection = SECTIONS.some((s) => s.id === sectionParam);
  if (!isValidSection) {
    notFound();
  }
  const section = sectionParam as SectionId;

  const sectionConfig = getSectionConfig(section);
  const questions = useMemo(() => getQuestionsForSection(section), [section]);

  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [phase, setPhase] = useState<Phase>("taking");

  const answeredCount = Object.values(answers).filter((v) => v !== null && v !== undefined).length;

  function handleSelect(questionId: string, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  }

  function handleSubmit() {
    setPhase("review");
  }

  const result = useMemo(() => {
    if (phase !== "review") return null;
    const answerList = questions.map((q) => ({
      questionId: q.id,
      selectedIndex: answers[q.id] ?? null,
    }));
    return scoreAttempt(questions, answerList);
  }, [phase, questions, answers]);

  return (
    <div className="flex flex-1 justify-center bg-white">
      <main className="w-full max-w-2xl px-6 py-10 sm:py-16">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
          <div>
            <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800">
              ← All sections
            </Link>
            <h1 className="mt-1 text-xl font-semibold text-neutral-900">{sectionConfig.label}</h1>
          </div>
          {phase === "taking" ? (
            <div className="text-right">
              <Timer minutes={sectionConfig.minutes} onExpire={handleSubmit} />
              <p className="mt-1 text-xs text-neutral-500">
                {answeredCount}/{questions.length} answered
              </p>
            </div>
          ) : (
            <Link
              href="/"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              Done
            </Link>
          )}
        </div>

        {phase === "review" && result && (
          <div className="mt-8">
            <ResultSummary result={result} sectionLabel={sectionConfig.label} />
          </div>
        )}

        <div className="mt-4">
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
        </div>

        {phase === "taking" && (
          <div className="sticky bottom-0 mt-6 border-t border-neutral-200 bg-white py-4">
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Submit ({answeredCount}/{questions.length} answered)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
