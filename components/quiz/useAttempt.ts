"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExamId, Question, SectionId } from "@/data/schema";
import { ExamModule, SectionConfig } from "@/lib/exams/types";
import {
  AdaptiveState,
  advanceAdaptiveState,
  initialAdaptiveState,
  pickNextQuestionId,
} from "@/lib/adaptive";
import {
  drawRandomQuestionIds,
  getLoadedSection,
  getQuestionsByIds,
  loadSection,
} from "@/lib/question-bank";
import { ScoreResult, scoreAttempt } from "@/lib/scoring";
import { ActiveAttempt, findActiveAttempt } from "@/lib/section-result";
import {
  StoredProgress,
  clearSectionProgress,
  emptyProgress,
  getStoredProgress,
  purgeLegacyPersistedProgress,
  saveStoredProgress,
} from "@/lib/session-progress";

/**
 * EVERYTHING AN ATTEMPT DOES, FOR ANY EXAM.
 *
 * Both runners (free-navigation and sequential/adaptive) drive this same hook.
 * The differences between exams are read from `exam.rules` here, never branched
 * on by exam id, so a new exam module gets working attempt state, persistence,
 * timing, the section lock, scoring, and expiry for free and only has to decide
 * how to draw its questions on screen.
 */

export type Phase =
  | "loading"
  /** Another section holds a live attempt and this exam locks you to one. */
  | "locked"
  | "taking"
  /** Reached the end with time left, on an exam that grants a capped review pass. */
  | "reviewEdit"
  /** Submitted; showing the scored review. */
  | "done";

/**
 * What, if anything, was restored from earlier in the session. Every one of
 * these is stated out loud rather than silently reinstated.
 */
export type NoticeKind = "resumed" | "completed" | "expired" | null;

export interface Attempt {
  phase: Phase;
  notice: NoticeKind;
  blockedBy: ActiveAttempt | null;

  /** Questions served so far, in display order. */
  questions: Question[];
  answers: Record<string, number | null>;
  flagged: string[];

  /** Index of the question on screen. Only meaningful for sequential navigation. */
  cursor: number;
  /** How many questions this section will serve in total. */
  totalQuestions: number;

  deadline: number;
  paused: boolean;
  /** Remaining time captured when pausing, so the overlay can show the clock it covers. */
  frozenTimeLabel: string | undefined;

  answeredCount: number;
  result: ScoreResult | null;
  reviewChangesLeft: number | null;

  select: (questionId: string, optionIndex: number) => void;
  toggleFlag: (questionId: string) => void;
  goToCursor: (index: number) => void;
  advance: () => void;
  submit: (expired?: boolean) => void;
  restart: () => void;
  pause: () => void;
  resume: () => void;
  onDeadlineChange: (next: number) => void;
}

interface Options {
  exam: ExamModule;
  section: SectionConfig;
  enabled: boolean;
}

function formatClock(msLeft: number): string {
  const secs = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;
}

export function useAttempt({ exam, section, enabled }: Options): Attempt {
  const examId: ExamId = exam.id;
  const sectionId: SectionId = section.id;
  const rules = exam.rules;

  const [phase, setPhase] = useState<Phase>("loading");
  const [notice, setNotice] = useState<NoticeKind>(null);
  const [blockedBy, setBlockedBy] = useState<ActiveAttempt | null>(null);
  const [questionIds, setQuestionIds] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [paused, setPaused] = useState(false);
  const [frozenTimeLabel, setFrozenTimeLabel] = useState<string | undefined>(undefined);
  const [adaptive, setAdaptive] = useState<AdaptiveState | null>(null);
  const [reviewChangesUsed, setReviewChangesUsed] = useState(0);
  const [bankVersion, setBankVersion] = useState(0);

  const pendingNoticeRef = useRef<NoticeKind>(null);
  /**
   * Which `examId:section` the loader has already run for. The loader both
   * draws a question set and writes it to storage, so a second invocation would
   * read its own first-pass write back and mistake a brand-new attempt for a
   * resumed one. React Strict Mode double-invokes mount effects in dev, which
   * made exactly that happen.
   */
  const loadedKeyRef = useRef<string | null>(null);

  const bank = useMemo(
    // bankVersion is the dependency that matters: the bank arrives
    // asynchronously, and this recomputes once it lands.
    () => (bankVersion >= 0 ? getLoadedSection(examId, sectionId) : []),
    [examId, sectionId, bankVersion]
  );

  const questions = useMemo(
    () => getQuestionsByIds(bank, questionIds),
    [bank, questionIds]
  );

  const persist = useCallback(
    (patch: Partial<StoredProgress>) => {
      const base: StoredProgress = {
        ...emptyProgress(),
        answers: {},
        submitted: false,
        questionIds,
        deadline,
        expired: false,
        pausedAt: 0,
        summary: null,
        flagged,
        reviewChangesUsed,
        adaptive,
        cursor,
        inReview: false,
      };
      saveStoredProgress(examId, sectionId, { ...base, ...patch });
    },
    [examId, sectionId, questionIds, deadline, flagged, reviewChangesUsed, adaptive, cursor]
  );

  /** Answers with nulls stripped, which is the shape storage holds. */
  const cleanAnswers = useCallback((source: Record<string, number | null>) => {
    const cleaned: Record<string, number> = {};
    for (const [id, value] of Object.entries(source)) {
      if (value !== null && value !== undefined) cleaned[id] = value;
    }
    return cleaned;
  }, []);

  // ------------------------------------------------------------------ load --
  useEffect(() => {
    if (!enabled) return;
    const loadKey = `${examId}:${sectionId}`;
    if (loadedKeyRef.current === loadKey) return;
    loadedKeyRef.current = loadKey;

    /**
     * Deliberately NOT cancelled on cleanup.
     *
     * React Strict Mode double-invokes mount effects in development as
     * mount -> cleanup -> mount. `loadedKeyRef` makes the second invocation
     * return early, so if the cleanup of the FIRST invocation cancelled its own
     * in-flight load, nothing would ever finish and the page would hang on a
     * blank screen forever. It did exactly that. The ref guard already
     * guarantees a single run per section, and a late setState after a real
     * unmount is a no-op in React 18 and later, so there is nothing to cancel.
     */
    (async () => {
      purgeLegacyPersistedProgress();
      const pool = await loadSection(examId, sectionId);
      setBankVersion((v) => v + 1);

      const stored = getStoredProgress(examId, sectionId);
      const isResume = stored.questionIds.length > 0;

      // Only a BRAND-NEW attempt is blocked. Resuming a section that already
      // has a drawn set is always allowed, both because its clock is already
      // running and because a pre-existing double attempt (from two tabs, or a
      // build before the lock existed) must stay reachable rather than becoming
      // a pair of sections that each refuse to open.
      if (!isResume) {
        const active = findActiveAttempt(examId, sectionId);
        if (active) {
          setBlockedBy(active);
          setPhase("locked");
          return;
        }
      }

      const now = Date.now();
      let { submitted, expired, deadline: endAt } = stored;
      if (!submitted) {
        if (!endAt) {
          endAt = now + section.minutes * 60_000;
        } else if (stored.pausedAt > 0) {
          // The attempt was paused when the page went away. Reloading ends the
          // pause, but the time spent paused was promised back, so push the
          // deadline out by however long it lasted before judging expiry.
          endAt += now - stored.pausedAt;
        } else if (endAt <= now) {
          // The clock ran out while the tab sat in the background. Close the
          // attempt out honestly instead of handing back a live-looking timer
          // that is already spent.
          submitted = true;
          expired = true;
        }
      }

      let ids = stored.questionIds;
      let adaptiveState = stored.adaptive;

      if (!isResume) {
        if (rules.adaptive) {
          // An adaptive section is served one question at a time, so only the
          // opener is drawn now; the rest are chosen as answers come in.
          adaptiveState = initialAdaptiveState(rules.adaptive);
          const first = pickNextQuestionId(pool, [], adaptiveState.level, null);
          ids = first ? [first] : [];
        } else {
          ids = drawRandomQuestionIds(pool, section.questionCount);
        }
      }

      setQuestionIds(ids);
      setAnswers(stored.answers);
      setFlagged(stored.flagged);
      setReviewChangesUsed(stored.reviewChangesUsed);
      setAdaptive(adaptiveState);
      setCursor(Math.min(stored.cursor, Math.max(0, ids.length - 1)));
      setDeadline(endAt);
      setPhase(submitted ? "done" : stored.inReview ? "reviewEdit" : "taking");

      // A started section counts as resumed even with zero answers: its clock
      // has been running the whole time, and an unexplained shortened timer is
      // exactly the surprise this banner exists to prevent. Held in a ref and
      // committed by the effect below so the text lands in a separate DOM
      // mutation from its live region, which is what makes it get announced.
      pendingNoticeRef.current = expired
        ? "expired"
        : !isResume
          ? null
          : submitted
            ? "completed"
            : "resumed";

      if (
        !isResume ||
        submitted !== stored.submitted ||
        endAt !== stored.deadline ||
        stored.pausedAt > 0
      ) {
        saveStoredProgress(examId, sectionId, {
          ...stored,
          answers: stored.answers,
          submitted,
          questionIds: ids,
          deadline: endAt,
          expired,
          pausedAt: 0,
          adaptive: adaptiveState,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, sectionId, enabled]);

  // Runs on the commit after the one that first renders the page, so the empty
  // role="status" region already exists in the DOM when its text appears.
  useEffect(() => {
    if (phase === "loading" || pendingNoticeRef.current === null) return;
    setNotice(pendingNoticeRef.current);
    pendingNoticeRef.current = null;
  }, [phase, questionIds]);

  // ----------------------------------------------------------------- derive --
  const answeredCount = Object.values(answers).filter((v) => v !== null && v !== undefined).length;

  const result = useMemo(() => {
    if (phase !== "done") return null;
    const answerList = questions.map((q) => ({
      questionId: q.id,
      selectedIndex: answers[q.id] ?? null,
    }));
    return scoreAttempt(questions, answerList, exam.scoring);
  }, [phase, questions, answers, exam.scoring]);

  const reviewChangesLeft = rules.reviewEdit
    ? Math.max(0, rules.reviewEdit.maxChanges - reviewChangesUsed)
    : null;

  // ---------------------------------------------------------------- actions --

  const closeOut = useCallback(
    (expired: boolean) => {
      // An attempt can only be closed out once. Without this guard a submit
      // confirmation left open while the timer runs out would still be sitting
      // there afterwards, and confirming it would re-close an already-expired
      // attempt, clearing the "time ran out" banner so the user never learns
      // what happened.
      if (phase === "done" || phase === "loading" || phase === "locked") return;

      setAnswers((prev) => {
        const served = getQuestionsByIds(getLoadedSection(examId, sectionId), questionIds);
        const scored = scoreAttempt(
          served,
          served.map((q) => ({ questionId: q.id, selectedIndex: prev[q.id] ?? null })),
          exam.scoring
        );
        persist({
          answers: cleanAnswers(prev),
          submitted: true,
          expired,
          inReview: false,
          summary: {
            score: scored.score,
            maxScore: scored.maxScore,
            correct: scored.correctCount,
            incorrect: scored.incorrectCount,
            unanswered: scored.unansweredCount,
            total: scored.totalQuestions,
          },
        });
        return prev;
      });
      setNotice(expired ? "expired" : null);
      setPhase("done");
    },
    [phase, persist, cleanAnswers, examId, sectionId, questionIds, exam.scoring]
  );

  const select = useCallback(
    (questionId: string, optionIndex: number) => {
      if (phase !== "taking" && phase !== "reviewEdit") return;

      // A capped review pass spends one of its allowance per answer CHANGED,
      // not per click: re-picking the same option, or answering something left
      // blank, must not burn an edit.
      if (phase === "reviewEdit" && rules.reviewEdit) {
        const previous = answers[questionId];
        const isChange = previous !== undefined && previous !== null && previous !== optionIndex;
        if (isChange && reviewChangesUsed >= rules.reviewEdit.maxChanges) return;
        if (isChange) {
          const used = reviewChangesUsed + 1;
          setReviewChangesUsed(used);
          setAnswers((prev) => {
            const next = { ...prev, [questionId]: optionIndex };
            persist({ answers: cleanAnswers(next), reviewChangesUsed: used, inReview: true });
            return next;
          });
          return;
        }
      }

      setAnswers((prev) => {
        const next = { ...prev, [questionId]: optionIndex };
        persist({ answers: cleanAnswers(next), inReview: phase === "reviewEdit" });
        return next;
      });
    },
    [phase, rules.reviewEdit, answers, reviewChangesUsed, persist, cleanAnswers]
  );

  const toggleFlag = useCallback(
    (questionId: string) => {
      setFlagged((prev) => {
        const next = prev.includes(questionId)
          ? prev.filter((id) => id !== questionId)
          : [...prev, questionId];
        persist({ answers: cleanAnswers(answers), flagged: next, inReview: phase === "reviewEdit" });
        return next;
      });
    },
    [persist, cleanAnswers, answers, phase]
  );

  const goToCursor = useCallback(
    (index: number) => {
      setCursor(index);
      persist({ answers: cleanAnswers(answers), cursor: index, inReview: phase === "reviewEdit" });
    },
    [persist, cleanAnswers, answers, phase]
  );

  /**
   * Moves to the next question on a sequential exam, serving a new one if the
   * section has not reached its full length yet. On an adaptive exam this is
   * also where the difficulty ladder moves.
   */
  const advance = useCallback(() => {
    if (phase !== "taking") return;

    const current = questions[cursor];
    if (!current) return;
    if (!rules.allowSkip && (answers[current.id] === undefined || answers[current.id] === null)) {
      return;
    }

    // Already served everything: this was the last question.
    if (questionIds.length >= section.questionCount) {
      // A capped review pass is only offered if there is still time to use it,
      // which is what makes finishing early worth something.
      if (rules.reviewEdit && Date.now() < deadline) {
        setPhase("reviewEdit");
        setCursor(0);
        persist({ answers: cleanAnswers(answers), cursor: 0, inReview: true });
        return;
      }
      closeOut(false);
      return;
    }

    let nextAdaptive = adaptive;
    let nextId: string | null;
    const pool = getLoadedSection(examId, sectionId);

    if (rules.adaptive && adaptive) {
      const wasCorrect = answers[current.id] === current.correctIndex;
      nextAdaptive = advanceAdaptiveState(adaptive, wasCorrect, rules.adaptive);
      nextId = pickNextQuestionId(pool, questionIds, nextAdaptive.level, current.topic);
    } else {
      nextId = pickNextQuestionId(pool, questionIds, current.difficulty, current.topic);
    }

    if (!nextId) {
      // The bank ran dry before the section's nominal length. Close out on what
      // was actually served rather than showing a blank question.
      closeOut(false);
      return;
    }

    const nextIds = [...questionIds, nextId];
    const nextCursor = nextIds.length - 1;
    setQuestionIds(nextIds);
    setAdaptive(nextAdaptive);
    setCursor(nextCursor);
    saveStoredProgress(examId, sectionId, {
      ...emptyProgress(),
      answers: cleanAnswers(answers),
      submitted: false,
      questionIds: nextIds,
      deadline,
      expired: false,
      pausedAt: 0,
      summary: null,
      flagged,
      reviewChangesUsed,
      adaptive: nextAdaptive,
      cursor: nextCursor,
      inReview: false,
    });
  }, [
    phase, questions, cursor, rules, answers, questionIds, section.questionCount,
    deadline, adaptive, examId, sectionId, flagged, reviewChangesUsed,
    persist, cleanAnswers, closeOut,
  ]);

  const restart = useCallback(() => {
    clearSectionProgress(examId, sectionId);
    const pool = getLoadedSection(examId, sectionId);
    let ids: string[];
    let adaptiveState: AdaptiveState | null = null;
    if (rules.adaptive) {
      adaptiveState = initialAdaptiveState(rules.adaptive);
      const first = pickNextQuestionId(pool, [], adaptiveState.level, null);
      ids = first ? [first] : [];
    } else {
      ids = drawRandomQuestionIds(pool, section.questionCount);
    }
    const endAt = Date.now() + section.minutes * 60_000;

    setQuestionIds(ids);
    setAnswers({});
    setFlagged([]);
    setReviewChangesUsed(0);
    setAdaptive(adaptiveState);
    setCursor(0);
    setDeadline(endAt);
    setPhase("taking");
    setNotice(null);
    setPaused(false);

    saveStoredProgress(examId, sectionId, {
      ...emptyProgress(),
      questionIds: ids,
      deadline: endAt,
      adaptive: adaptiveState,
    });
  }, [examId, sectionId, rules.adaptive, section.questionCount, section.minutes]);

  const pause = useCallback(() => {
    setPaused(true);
    setFrozenTimeLabel(formatClock(deadline - Date.now()));
    // Read through the updater, not the render closure: an answer click and a
    // pause in the same frame would otherwise write a one-render-stale map.
    const pausedAt = Date.now();
    setAnswers((prev) => {
      persist({ answers: cleanAnswers(prev), pausedAt, inReview: phase === "reviewEdit" });
      return prev;
    });
  }, [deadline, persist, cleanAnswers, phase]);

  const resume = useCallback(() => {
    setPaused(false);
    // The Timer reports the pause-shifted deadline via onDeadlineChange, which
    // persists it and clears pausedAt.
  }, []);

  const onDeadlineChange = useCallback(
    (next: number) => {
      setDeadline(next);
      setAnswers((prev) => {
        persist({ answers: cleanAnswers(prev), deadline: next, inReview: phase === "reviewEdit" });
        return prev;
      });
    },
    [persist, cleanAnswers, phase]
  );

  const submit = useCallback((expired = false) => closeOut(expired), [closeOut]);

  return {
    phase,
    notice,
    blockedBy,
    questions,
    answers,
    flagged,
    cursor,
    totalQuestions: section.questionCount,
    deadline,
    paused,
    frozenTimeLabel,
    answeredCount,
    result,
    reviewChangesLeft,
    select,
    toggleFlag,
    goToCursor,
    advance,
    submit,
    restart,
    pause,
    resume,
    onDeadlineChange,
  };
}
