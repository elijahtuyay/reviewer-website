import { ExamId, SectionId } from "@/data/schema";
import { getQuestionsByIds } from "@/lib/data/questions";
import { getStoredProgress } from "@/lib/session-progress";

export interface SectionBreakdown {
  submitted: boolean;
  total: number;
  answered: number;
  skipped: number;
  correct: number;
  incorrect: number;
}

/** Reads a section's saved progress for this browser session and, if it was submitted, scores it against the drawn question set. */
export function getSectionBreakdown(examId: ExamId, sectionId: SectionId, fallbackTotal: number): SectionBreakdown {
  const stored = getStoredProgress(examId, sectionId);
  const total = stored.questionIds.length || fallbackTotal;
  const answered = Object.keys(stored.answers).length;
  const skipped = Math.max(total - answered, 0);

  if (!stored.submitted) {
    return { submitted: false, total, answered, skipped, correct: 0, incorrect: 0 };
  }

  const questions = getQuestionsByIds(examId, sectionId, stored.questionIds);
  let correct = 0;
  let incorrect = 0;
  for (const question of questions) {
    const selected = stored.answers[question.id];
    if (selected === undefined) continue;
    if (selected === question.correctIndex) correct++;
    else incorrect++;
  }
  return { submitted: true, total, answered, skipped, correct, incorrect };
}
