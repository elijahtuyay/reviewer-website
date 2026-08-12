import { ExamId, SectionId } from "@/data/schema";

export interface StoredProgress {
  answers: Record<string, number>;
  submitted: boolean;
  questionIds: string[];
}

const EMPTY_PROGRESS: StoredProgress = { answers: {}, submitted: false, questionIds: [] };

function storageKey(examId: ExamId, section: SectionId): string {
  return `progress:${examId}:${section}`;
}

export function getStoredProgress(examId: ExamId, section: SectionId): StoredProgress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  try {
    const raw = window.localStorage.getItem(storageKey(examId, section));
    if (!raw) return EMPTY_PROGRESS;
    return JSON.parse(raw) as StoredProgress;
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveStoredProgress(examId: ExamId, section: SectionId, progress: StoredProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(examId, section), JSON.stringify(progress));
  } catch {
    // Storage disabled/full (e.g. Safari private browsing quota) — progress just
    // won't persist across reloads; the in-memory quiz state still works fine.
  }
}

export function getAnsweredCount(examId: ExamId, section: SectionId): number {
  return Object.keys(getStoredProgress(examId, section).answers).length;
}
