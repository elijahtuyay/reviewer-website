import { SectionId } from "@/data/schema";

export interface StoredProgress {
  answers: Record<string, number>;
  submitted: boolean;
}

const EMPTY_PROGRESS: StoredProgress = { answers: {}, submitted: false };

function storageKey(section: SectionId): string {
  return `nmat-progress:${section}`;
}

export function getStoredProgress(section: SectionId): StoredProgress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  try {
    const raw = window.localStorage.getItem(storageKey(section));
    if (!raw) return EMPTY_PROGRESS;
    return JSON.parse(raw) as StoredProgress;
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveStoredProgress(section: SectionId, progress: StoredProgress): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(section), JSON.stringify(progress));
}

export function getAnsweredCount(section: SectionId): number {
  return Object.keys(getStoredProgress(section).answers).length;
}
