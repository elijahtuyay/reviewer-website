import { ExamId, SectionId } from "@/data/schema";
import { getExamConfig } from "@/lib/exam-config";
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

export interface ActiveAttempt {
  sectionId: SectionId;
  label: string;
  answered: number;
  total: number;
}

/**
 * The section that currently holds a live, unfinished attempt, or null.
 *
 * The app has always TOLD users that a section locks you in until you submit
 * it ("just like the real exam"), and SectionNav has always greyed out the
 * other sections while one is running. Nothing enforced it: the greying is
 * cosmetic, and /nmat plus the home page both link straight to every quiz URL.
 * Starting a second section therefore left two clocks burning at once, with
 * the first one silently bleeding out. This is the check that makes the claim
 * true.
 *
 * "Live" deliberately excludes an attempt whose deadline has already passed
 * and which is not paused. That attempt is over in every sense but the
 * bookkeeping (opening it submits it), so letting it block the other sections
 * would strand the user until they went and cleared it by hand. A paused
 * attempt does count: its stored deadline is stale by design, and pausing is
 * an explicit statement that you intend to come back.
 */
export function findActiveAttempt(
  examId: ExamId,
  excludeSection?: SectionId
): ActiveAttempt | null {
  const now = Date.now();
  for (const section of getExamConfig(examId).sections) {
    if (section.id === excludeSection) continue;
    const stored = getStoredProgress(examId, section.id);
    if (stored.questionIds.length === 0 || stored.submitted) continue;
    const paused = stored.pausedAt > 0;
    if (!paused && stored.deadline > 0 && stored.deadline <= now) continue;
    return {
      sectionId: section.id,
      label: section.label,
      answered: Object.keys(stored.answers).length,
      total: stored.questionIds.length,
    };
  }
  return null;
}
