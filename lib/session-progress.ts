import { ExamId, SectionId } from "@/data/schema";

export interface StoredProgress {
  answers: Record<string, number>;
  submitted: boolean;
  questionIds: string[];
  /** Wall-clock epoch ms when this section's timer runs out. 0 means the section hasn't been started yet. */
  deadline: number;
  /** True when the section was submitted by the timer running out rather than by the user. */
  expired: boolean;
  /**
   * Epoch ms the current pause began, or 0 when not paused. Persisted so that a
   * reload while paused doesn't charge the user for the time they were away —
   * the deadline is only shifted forward on resume, so without this the stored
   * deadline still reflects the pre-pause clock.
   */
  pausedAt: number;
}

const KEY_PREFIX = "progress:";

function emptyProgress(): StoredProgress {
  return { answers: {}, submitted: false, questionIds: [], deadline: 0, expired: false, pausedAt: 0 };
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
    return {
      answers: parsed.answers ?? {},
      submitted: parsed.submitted ?? false,
      questionIds: parsed.questionIds ?? [],
      deadline: parsed.deadline ?? 0,
      expired: parsed.expired ?? false,
      pausedAt: parsed.pausedAt ?? 0,
    };
  } catch {
    return emptyProgress();
  }
}

export function saveStoredProgress(examId: ExamId, section: SectionId, progress: StoredProgress): void {
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
