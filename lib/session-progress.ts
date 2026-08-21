import { ExamId, SectionId } from "@/data/schema";
import { AdaptiveState } from "@/lib/adaptive";

/**
 * A snapshot of the scored result, written once at submit time.
 *
 * This exists so that showing "Language Skills: 24/36 correct" on the setup
 * page or in the section nav does not require loading that section's question
 * bank to re-derive it. Before this, every one of those little summaries pulled
 * the whole bank in, which is what put the entire question set on the critical
 * path of pages with no quiz on them.
 */
export interface StoredSummary {
  score: number;
  maxScore: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
}

export interface StoredProgress {
  answers: Record<string, number>;
  submitted: boolean;
  /**
   * The drawn question set, in display order. For an adaptive section this
   * grows one id at a time as questions are served, so its length doubles as
   * "how far through the section you are".
   */
  questionIds: string[];
  /** Wall-clock epoch ms when this section's timer runs out. 0 means not started. */
  deadline: number;
  /** True when the section was submitted by the timer running out rather than by the user. */
  expired: boolean;
  /**
   * Epoch ms the current pause began, or 0. Persisted so a reload while paused
   * doesn't charge the user for time they were away: the deadline is only
   * shifted forward on resume.
   */
  pausedAt: number;
  /** Scored result, once submitted. Null while the attempt is live. */
  summary: StoredSummary | null;
  /** Question ids the candidate marked to come back to. Only used by exams that allow flagging. */
  flagged: string[];
  /**
   * The answers as they stood when the capped review phase opened.
   *
   * The allowance is spent per answer that DIFFERS from this, not per click.
   * Counting clicks meant a misclick cost two of three changes: one to move
   * away from the original answer and another to move back, with the attempt
   * ending up exactly where it started.
   */
  reviewBaseline: Record<string, number>;
  /** Difficulty ladder position, for adaptive sections. Null for fixed-form ones. */
  adaptive: AdaptiveState | null;
  /** Sequential sections track which question is on screen; free-navigation ones ignore it. */
  cursor: number;
  /** True once the candidate has reached the end and entered the capped review phase. */
  inReview: boolean;
}

const KEY_PREFIX = "progress:";

export function emptyProgress(): StoredProgress {
  return {
    answers: {},
    submitted: false,
    questionIds: [],
    deadline: 0,
    expired: false,
    pausedAt: 0,
    summary: null,
    flagged: [],
    reviewBaseline: {},
    adaptive: null,
    cursor: 0,
    inReview: false,
  };
}

function storageKey(examId: ExamId, section: SectionId): string {
  return `${KEY_PREFIX}${examId}:${section}`;
}

// Attempt progress is deliberately kept in sessionStorage, not localStorage: it
// survives reloads and navigation within the same tab, but dies when the tab or
// browser closes. A half-finished attempt that outlives the browser session is
// worse than useless — you come back to a stale question set and an already-blown
// timer with no memory of why — so leaving the app resets everything.
function sessionStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function getStoredProgress(examId: ExamId, section: SectionId): StoredProgress {
  const store = sessionStore();
  if (!store) return emptyProgress();
  try {
    const raw = store.getItem(storageKey(examId, section));
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<StoredProgress>;
    // Field-by-field with defaults rather than a spread: a record written by an
    // older build is missing the newer fields, and a half-populated object would
    // crash the quiz rather than degrade.
    return {
      ...emptyProgress(),
      answers: parsed.answers ?? {},
      submitted: parsed.submitted ?? false,
      questionIds: parsed.questionIds ?? [],
      deadline: parsed.deadline ?? 0,
      expired: parsed.expired ?? false,
      pausedAt: parsed.pausedAt ?? 0,
      summary: parsed.summary ?? null,
      flagged: parsed.flagged ?? [],
      reviewBaseline: parsed.reviewBaseline ?? {},
      adaptive: parsed.adaptive ?? null,
      cursor: parsed.cursor ?? 0,
      inReview: parsed.inReview ?? false,
    };
  } catch {
    return emptyProgress();
  }
}

export function saveStoredProgress(
  examId: ExamId,
  section: SectionId,
  progress: StoredProgress
): void {
  const store = sessionStore();
  if (!store) return;
  try {
    store.setItem(storageKey(examId, section), JSON.stringify(progress));
  } catch {
    // Storage disabled/full (e.g. Safari private browsing quota) — progress just
    // won't persist across reloads; the in-memory quiz state still works fine.
  }
}

export function clearSectionProgress(examId: ExamId, section: SectionId): void {
  const store = sessionStore();
  if (!store) return;
  try {
    store.removeItem(storageKey(examId, section));
  } catch {
    // Nothing to do — the caller's in-memory reset still takes effect.
  }
}

export function clearExamProgress(examId: ExamId): void {
  const store = sessionStore();
  if (!store) return;
  try {
    const prefix = `${KEY_PREFIX}${examId}:`;
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(prefix)) doomed.push(key);
    }
    for (const key of doomed) store.removeItem(key);
  } catch {
    // Same as above — best effort.
  }
}

/**
 * Progress used to be written to localStorage, where it survived indefinitely.
 * Anyone who used an earlier build still has those keys sitting around, and they
 * would never be read again — clear them out so the old data doesn't linger.
 */
export function purgeLegacyPersistedProgress(): void {
  if (typeof window === "undefined") return;
  try {
    const store = window.localStorage;
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(KEY_PREFIX)) doomed.push(key);
    }
    for (const key of doomed) store.removeItem(key);
  } catch {
    // localStorage unavailable; nothing to clean up.
  }
}
