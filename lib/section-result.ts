import { ExamId, SectionId } from "@/data/schema";
import { getExam } from "@/lib/exams/registry";
import { getStoredProgress } from "@/lib/session-progress";

export interface SectionBreakdown {
  submitted: boolean;
  total: number;
  answered: number;
  skipped: number;
  correct: number;
  incorrect: number;
  /** Present only for a submitted attempt. */
  score: number | null;
  maxScore: number | null;
}

/**
 * A section's state for this browser session, read purely from storage.
 *
 * Deliberately does NOT touch the question bank. It used to re-score the
 * attempt by loading the section's questions and comparing answers, which meant
 * every "24/36 correct" label on the setup page dragged a whole bank into the
 * bundle. The score is now written once at submit time, so this is a cheap
 * storage read and the setup page ships no questions at all.
 */
export function getSectionBreakdown(
  examId: ExamId,
  sectionId: SectionId,
  fallbackTotal: number
): SectionBreakdown {
  const stored = getStoredProgress(examId, sectionId);
  const answered = Object.keys(stored.answers).length;

  if (stored.submitted && stored.summary) {
    const s = stored.summary;
    return {
      submitted: true,
      total: s.total,
      answered: s.correct + s.incorrect,
      skipped: s.unanswered,
      correct: s.correct,
      incorrect: s.incorrect,
      score: s.score,
      maxScore: s.maxScore,
    };
  }

  const total = stored.questionIds.length || fallbackTotal;
  return {
    submitted: stored.submitted,
    total,
    answered,
    skipped: Math.max(total - answered, 0),
    correct: 0,
    incorrect: 0,
    score: null,
    maxScore: null,
  };
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
 * Both exams tell the candidate that a section locks you in until you submit
 * it, and the section nav greys out the others. Nothing enforced it until this
 * function existed: the greying was cosmetic and every page linked straight to
 * every quiz URL, so starting a second section left two clocks burning with the
 * first silently bleeding out.
 *
 * "Live" deliberately excludes an attempt whose deadline has passed and which
 * is not paused. That attempt is over in every sense but the bookkeeping
 * (opening it submits it), so letting it block the other sections would strand
 * the candidate until they cleared it by hand. A paused attempt does count:
 * its stored deadline is stale by design, and pausing says you are coming back.
 */
export function findActiveAttempt(
  examId: ExamId,
  excludeSection?: SectionId
): ActiveAttempt | null {
  const exam = getExam(examId);
  if (!exam.rules.lockToOneSection) return null;

  const now = Date.now();
  for (const section of exam.sections) {
    if (section.id === excludeSection) continue;
    const stored = getStoredProgress(examId, section.id);
    if (stored.questionIds.length === 0 || stored.submitted) continue;
    const paused = stored.pausedAt > 0;
    if (!paused && stored.deadline > 0 && stored.deadline <= now) continue;
    return {
      sectionId: section.id,
      label: section.label,
      answered: Object.keys(stored.answers).length,
      total: stored.questionIds.length || section.questionCount,
    };
  }
  return null;
}
