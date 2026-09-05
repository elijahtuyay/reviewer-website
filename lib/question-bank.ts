import { ExamId, ExplanationMap, Question, SectionId } from "@/data/schema";
import { findExam } from "@/lib/exams/registry";

/**
 * Per-section question loading, with a cache.
 *
 * Previously every exam's every section was a static `import` in one module, so
 * the entire question bank rode along on any page that touched anything
 * question-shaped. That put ~220 KB of questions, answers, and explanations on
 * the critical path of the exam setup page and of every quiz section, including
 * the two sections you were not taking. With a second exam in the registry that
 * would have doubled.
 *
 * Now each section is a dynamic import, so a section's questions arrive as
 * their own chunk the first time that section is opened, and never otherwise.
 *
 * The sync/async split exists because React render is synchronous: the quiz
 * page awaits `loadSection` once in an effect, then reads the same data
 * synchronously on every subsequent render through `getLoadedSection`.
 */

const cache = new Map<string, Question[]>();
const inflight = new Map<string, Promise<Question[]>>();

function key(examId: ExamId, sectionId: SectionId): string {
  return `${examId}:${sectionId}`;
}

/**
 * Loads a section's bank, or returns it immediately if already loaded.
 * Concurrent callers share one import rather than racing.
 */
export function loadSection(examId: ExamId, sectionId: SectionId): Promise<Question[]> {
  const k = key(examId, sectionId);
  const cached = cache.get(k);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(k);
  if (existing) return existing;

  const exam = findExam(examId);
  if (!exam) return Promise.resolve([]);

  const promise = exam
    .loadSection(sectionId)
    .then((questions) => {
      cache.set(k, questions);
      inflight.delete(k);
      return questions;
    })
    .catch((error) => {
      // A failed chunk fetch (offline, deploy mid-session) must not poison the
      // cache: dropping the in-flight entry lets a retry actually retry.
      //
      // It also must not resolve to an empty array. Doing that handed the quiz
      // a section with no questions AND a live deadline, so the user got a
      // running timer above a blank page with no error and no way to retry.
      // Rethrowing lets the caller show an error state instead.
      inflight.delete(k);
      throw error;
    });

  inflight.set(k, promise);
  return promise;
}

/**
 * The already-loaded bank for a section, or an empty array. Safe to call during
 * render; callers that need the real data must have awaited `loadSection`
 * first.
 */
export function getLoadedSection(examId: ExamId, sectionId: SectionId): Question[] {
  return cache.get(key(examId, sectionId)) ?? [];
}

/*
 * EXPLANATIONS ARE A SECOND, LATER LOAD.
 *
 * They are 20% to 47% of a section's bank and not one of them can be seen until
 * the candidate submits, so shipping them with the questions put up to 35 KB of
 * prose in front of a timed section that had not started yet. They now arrive
 * as their own chunk, requested at submit time.
 *
 * Same cache-and-inflight discipline as the questions, and the same refusal to
 * cache a failure, so a retry can actually retry. What this must NOT do is
 * resolve to an empty map on failure: the review screen would then render every
 * explanation blank, which reads as an explanation nobody wrote rather than as
 * a chunk that never arrived. The caller catches and the card says it is still
 * loading.
 */
const explanationCache = new Map<string, ExplanationMap>();
const explanationInflight = new Map<string, Promise<ExplanationMap>>();

export function loadExplanations(
  examId: ExamId,
  sectionId: SectionId
): Promise<ExplanationMap> {
  const k = key(examId, sectionId);
  const cached = explanationCache.get(k);
  if (cached) return Promise.resolve(cached);

  const existing = explanationInflight.get(k);
  if (existing) return existing;

  const exam = findExam(examId);
  if (!exam) return Promise.resolve({});

  const promise = exam
    .loadExplanations(sectionId)
    .then((map) => {
      explanationCache.set(k, map);
      explanationInflight.delete(k);
      return map;
    })
    .catch((error) => {
      explanationInflight.delete(k);
      throw error;
    });

  explanationInflight.set(k, promise);
  return promise;
}

/**
 * The already-loaded explanations for a section, or an empty map. Safe during
 * render, like `getLoadedSection`.
 */
export function getLoadedExplanations(examId: ExamId, sectionId: SectionId): ExplanationMap {
  return explanationCache.get(key(examId, sectionId)) ?? {};
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Reorders an already-random subset so topics are spread out, preferring no two
 * consecutive questions to share a topic and never allowing three.
 *
 * Without this, questions display in bank order and the bank is authored topic
 * by topic, so a random subset still lands in visible clusters. Two passes,
 * strictest first: preferring a topic different from the immediately preceding
 * one is what stops every attempt opening with a matched pair, since the greedy
 * largest-first pick would otherwise always win positions 1 and 2 with the
 * draw's biggest topic. Falling back to the looser "never three in a row" keeps
 * this best-effort, so a topic-imbalanced draw still places its tail.
 */
export function interleaveByTopic(items: Question[]): Question[] {
  const groups = new Map<string, Question[]>();
  for (const item of items) {
    const group = groups.get(item.topic) ?? [];
    group.push(item);
    groups.set(item.topic, group);
  }

  const result: Question[] = [];
  let lastTopic: string | null = null;
  let secondLastTopic: string | null = null;

  while (result.length < items.length) {
    const candidates = [...groups.entries()]
      .filter(([, group]) => group.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    const differsFromLast = ([topic]: [string, Question[]]) => topic !== lastTopic;
    const wouldRepeat = ([topic]: [string, Question[]]) =>
      topic === lastTopic && topic === secondLastTopic;
    const [topic, group] =
      candidates.find(differsFromLast) ?? candidates.find((c) => !wouldRepeat(c)) ?? candidates[0];

    result.push(group.shift() as Question);
    secondLastTopic = lastTopic;
    lastTopic = topic;
  }

  return result;
}

/** Draws a fresh random subset arranged so consecutive questions avoid sharing a topic. */
export function drawRandomQuestionIds(questions: Question[], count: number): string[] {
  const drawn = shuffle(questions).slice(0, count);
  return interleaveByTopic(drawn).map((q) => q.id);
}

/** Reconstructs the exact question set for a previously-drawn attempt, preserving display order. */
export function getQuestionsByIds(questions: Question[], ids: string[]): Question[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter((q): q is Question => q !== undefined);
}
