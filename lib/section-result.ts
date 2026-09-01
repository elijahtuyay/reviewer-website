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
  /**
   * False when the attempt is submitted but no stored summary exists, which
   * happens for a record written by a build older than the summary field.
   * Callers must render "submitted" WITHOUT a tally in that case: falling back
   * to zeros reported a real result as 0 correct everywhere outside the quiz.
   */
  scoreKnown: boolean;
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
  /**
   * The SECTION's full length, and the authoritative denominator for an
   * in-progress attempt. Named for what it is rather than `fallbackTotal`,
   * because treating it as a fallback is precisely the bug that was here: the
   * stored id list was preferred and only fell back to this when nothing was
   * stored.
   */
  sectionQuestionCount: number
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
      scoreKnown: true,
    };
  }

  // The section's length, NEVER stored.questionIds.length. On a sequential,
  // adaptive section the stored list holds only what has been SERVED so far, so
  // preferring it reported a 20-question Data Insights attempt as "3/3
  // answered" three questions in — on the home page, in the session notice, and
  // anywhere else that asked. This is the same rule findActiveAttempt already
  // followed; only this function was left behind, while the comment at
  // SectionStartButton's call site claimed the fix was in place.
  //
  // `|| stored.questionIds.length` is a floor, not a fallback: it protects the
  // arithmetic below if a caller ever passes 0, and it can only ever be reached
  // when the real count is unavailable.
  const total = sectionQuestionCount || stored.questionIds.length;
  return {
    submitted: stored.submitted,
    total,
    answered,
    skipped: Math.max(total - answered, 0),
    correct: 0,
    incorrect: 0,
    score: null,
    maxScore: null,
    scoreKnown: false,
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
 * it, and the section nav grays out the others. Nothing enforced it until this
 * function existed: the graying was cosmetic and every page linked straight to
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
      // The SECTION's length, not the number served so far. On a sequential
      // exam the served list grows as you go, so four questions into a
      // twenty-question section the lock screen read "4 of 5 answered".
      total: section.questionCount,
    };
  }
  return null;
}
