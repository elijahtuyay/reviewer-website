"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { preloadMath, questionNeedsMath } from "@/components/MathText";
import { AnswerValue, isAnswered, isComplete, isCorrectAnswer, sameAnswer } from "@/lib/answers";
import type { ExamId, Question, SectionId } from "@/data/schema";
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
  | "done"
  /** The question bank could not be fetched. Nothing was started, nothing was charged. */
  | "error";

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
  answers: Record<string, AnswerValue | null>;
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
  /** Whether this question's answer may still be changed during a capped review pass. */
  canChangeAnswer: (questionId: string) => boolean;

  select: (questionId: string, value: AnswerValue) => void;
  toggleFlag: (questionId: string) => void;
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
  const [answers, setAnswers] = useState<Record<string, AnswerValue | null>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [paused, setPaused] = useState(false);
  const [frozenTimeLabel, setFrozenTimeLabel] = useState<string | undefined>(undefined);
  const [adaptive, setAdaptive] = useState<AdaptiveState | null>(null);
  const [reviewBaseline, setReviewBaseline] = useState<Record<string, AnswerValue>>({});
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
        reviewBaseline,
        adaptive,
        cursor,
        inReview: false,
      };
      saveStoredProgress(examId, sectionId, { ...base, ...patch });
    },
    [examId, sectionId, questionIds, deadline, flagged, reviewBaseline, adaptive, cursor]
  );

  /** Answers with nulls stripped, which is the shape storage holds. */
  const cleanAnswers = useCallback((source: Record<string, AnswerValue | null>) => {
    const cleaned: Record<string, AnswerValue> = {};
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
     * Deliberately NOT canceled on cleanup.
     *
     * React Strict Mode double-invokes mount effects in development as
     * mount -> cleanup -> mount. `loadedKeyRef` makes the second invocation
     * return early, so if the cleanup of the FIRST invocation canceled its own
     * in-flight load, nothing would ever finish and the page would hang on a
     * blank screen forever. It did exactly that. The ref guard already
     * guarantees a single run per section, and a late setState after a real
     * unmount is a no-op in React 18 and later, so there is nothing to cancel.
     */
    (async () => {
      purgeLegacyPersistedProgress();

      let pool: Question[];
      try {
        pool = await loadSection(examId, sectionId);
      } catch {
        // Nothing is drawn, no deadline is written, and no clock starts. The
        // previous behavior resolved to an empty array and produced a running
        // timer above a blank page with no way to retry.
        setPhase("error");
        return;
      }
      if (pool.length === 0) {
        setPhase("error");
        return;
      }
      setBankVersion((v) => v + 1);

      // KaTeX is code-split, so start its chunk downloading the moment we know
      // this section actually contains math — while the candidate is still
      // reading question one, rather than making them wait a round trip when
      // the first formula tries to render. Two of the six sections contain no
      // math at all and correctly never ask for it.
      if (pool.some(questionNeedsMath)) {
        preloadMath();
      }

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
      let closedOutOnLoad = false;
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
          closedOutOnLoad = true;
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
      setReviewBaseline(stored.reviewBaseline);
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
        /**
         * An attempt that expires while the tab is elsewhere is submitted right
         * here, and it must be scored here too. Writing `submitted: true` with
         * `summary: null` left every screen OUTSIDE the quiz page reporting the
         * attempt as zero correct, because that is what getSectionBreakdown
         * falls back to. The pool is loaded at this point, so there is no
         * reason not to score it properly.
         */
        let summary = stored.summary;
        if (closedOutOnLoad) {
          const served = getQuestionsByIds(pool, ids);
          const scored = scoreAttempt(
            served,
            served.map((q) => ({ questionId: q.id, value: stored.answers[q.id] ?? null })),
            exam.scoring,
            section.questionCount
          );
          summary = {
            score: scored.score,
            maxScore: scored.maxScore,
            correct: scored.correctCount,
            incorrect: scored.incorrectCount,
            unanswered: scored.unansweredCount,
            total: scored.totalQuestions,
          };
        }
        saveStoredProgress(examId, sectionId, {
          ...stored,
          answers: stored.answers,
          submitted,
          questionIds: ids,
          deadline: endAt,
          expired,
          pausedAt: 0,
          adaptive: adaptiveState,
          summary,
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
  // isAnswered, not a null check: an empty numeric entry is a string, and an
  // untouched multi-select is an empty array. Both are truthy objects that a
  // null check counts as answers, which would have reported a section as fully
  // answered before the candidate typed anything.
  const answeredCount = Object.values(answers).filter(isAnswered).length;

  const result = useMemo(() => {
    if (phase !== "done") return null;
    const answerList = questions.map((q) => ({
      questionId: q.id,
      value: answers[q.id] ?? null,
    }));
    // section.questionCount, not questions.length: on an adaptive section the
    // served list stops where the clock did, and scoring out of what you
    // happened to reach made timing out early the cheapest route to a high band.
    return scoreAttempt(questions, answerList, exam.scoring, section.questionCount);
  }, [phase, questions, answers, exam.scoring, section.questionCount]);

  /**
   * Spent allowance = answers that currently DIFFER from the snapshot taken when
   * the review pass opened. Derived rather than counted, so moving away from an
   * answer and back again costs nothing: a misclick used to burn two of three.
   */
  const reviewChangesUsed = Object.entries(reviewBaseline).filter(
    // sameAnswer, not `!==`: two arrays holding the same two option indices are
    // never `!==`-equal, so a Sentence Equivalence answer counted as changed on
    // every render and burned the whole review allowance without a single click.
    ([id, original]) => isAnswered(answers[id]) && !sameAnswer(answers[id], original)
  ).length;
  const reviewChangesLeft = rules.reviewEdit
    ? Math.max(0, rules.reviewEdit.maxChanges - reviewChangesUsed)
    : null;
  /**
   * The baseline, mirrored into a ref.
   *
   * `select` must consult the review allowance, but taking `reviewBaseline` and
   * `answers` as dependencies gave `select` a new identity on every single
   * answer. That is what made memoizing QuestionCard impossible and re-rendered
   * all 36 cards on every click. The ref lets `select` stay stable while still
   * reading the current value.
   */
  const reviewBaselineRef = useRef(reviewBaseline);
  useEffect(() => {
    reviewBaselineRef.current = reviewBaseline;
  }, [reviewBaseline]);

  /** True when this question can still be changed: already altered, or allowance left. */
  const canChangeAnswer = useCallback(
    (questionId: string) => {
      if (phase !== "reviewEdit" || !rules.reviewEdit) return true;
      const original = reviewBaseline[questionId];
      if (original === undefined) return true;
      if (!sameAnswer(answers[questionId], original)) return true;
      return reviewChangesUsed < rules.reviewEdit.maxChanges;
    },
    [phase, rules.reviewEdit, reviewBaseline, answers, reviewChangesUsed]
  );

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
          served.map((q) => ({ questionId: q.id, value: prev[q.id] ?? null })),
          exam.scoring,
          section.questionCount
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
    [phase, persist, cleanAnswers, examId, sectionId, questionIds, exam.scoring, section.questionCount]
  );

  /**
   * Deliberately does NOT depend on `answers`.
   *
   * It used to, through `canChangeAnswer`, which made `select` a new function
   * after every click. Every QuestionCard then got a new `onSelect` prop, so
   * memoizing the card was pointless and one answer re-rendered all 36 of them.
   * The allowance check now runs inside the state updater against `prev`, which
   * is the freshest answers by definition — strictly more correct than the
   * closure it replaced, as well as cheaper.
   */
  const select = useCallback(
    (questionId: string, value: AnswerValue) => {
      if (phase !== "taking" && phase !== "reviewEdit") return;

      setAnswers((prev) => {
        // The allowance is measured against the baseline, so reverting a
        // question to what it was when review opened is always free and never
        // blocked. Mirrors canChangeAnswer, which still exists for the UI to
        // ask the same thing while rendering.
        if (phase === "reviewEdit" && rules.reviewEdit) {
          const baseline = reviewBaselineRef.current;
          const original = baseline[questionId];
          const used = Object.entries(baseline).filter(
            // sameAnswer, not `!==`. See the note on reviewChangesUsed: an
            // array answer is never `!==`-equal to an identical array, so this
            // counted every multi-select question as a spent change forever.
            ([id, was]) => isAnswered(prev[id]) && !sameAnswer(prev[id], was)
          ).length;
          const blocked =
            original !== undefined &&
            sameAnswer(prev[questionId], original) &&
            used >= rules.reviewEdit.maxChanges;
          if (blocked) return prev;
        }

        const next = { ...prev, [questionId]: value };
        persist({ answers: cleanAnswers(next), inReview: phase === "reviewEdit" });
        return next;
      });
    },
    [phase, rules.reviewEdit, persist, cleanAnswers]
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

  /**
   * Moves to the next question on a sequential exam, serving a new one if the
   * section has not reached its full length yet. On an adaptive exam this is
   * also where the difficulty ladder moves.
   */
  const advance = useCallback(() => {
    if (phase !== "taking") return;

    const current = questions[cursor];
    if (!current) return;
    // isComplete, not merely "something is there": on an exam that refuses to
    // advance without an answer, one of the two picks on a select-two question
    // is not an answer yet.
    if (!rules.allowSkip && !isComplete(current, answers[current.id])) {
      return;
    }

    // Already served everything: this was the last question.
    if (questionIds.length >= section.questionCount) {
      // A capped review pass is only offered if there is still time to use it,
      // which is what makes finishing early worth something.
      // If the clock died before onExpire fired, this is an expiry, not a
      // voluntary submit: closing out with expired=false would clear the
      // "time ran out" banner and never tell the user what happened.
      if (Date.now() >= deadline) {
        closeOut(true);
        return;
      }
      if (rules.reviewEdit) {
        const baseline = cleanAnswers(answers);
        setReviewBaseline(baseline);
        setPhase("reviewEdit");
        setCursor(0);
        persist({
          answers: baseline,
          cursor: 0,
          inReview: true,
          reviewBaseline: baseline,
        });
        return;
      }
      closeOut(false);
      return;
    }

    let nextAdaptive = adaptive;
    let nextId: string | null;
    const pool = getLoadedSection(examId, sectionId);

    if (rules.adaptive && adaptive) {
      const wasCorrect = isCorrectAnswer(current, answers[current.id]);
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
      reviewBaseline,
      adaptive: nextAdaptive,
      cursor: nextCursor,
      inReview: false,
    });
  }, [
    phase, questions, cursor, rules, answers, questionIds, section.questionCount,
    deadline, adaptive, examId, sectionId, flagged, reviewBaseline,
    persist, cleanAnswers, closeOut,
  ]);

  const restart = useCallback(() => {
    // The lock was only ever checked on load, and only for a brand-new draw, so
    // Retake was a way around it: submit section A, start section B, go back to
    // A and retake it, and two clocks are running at once.
    const active = findActiveAttempt(examId, sectionId);
    if (active) {
      setBlockedBy(active);
      setPhase("locked");
      return;
    }
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
    setReviewBaseline({});
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
    canChangeAnswer,
    select,
    toggleFlag,
    advance,
    submit,
    restart,
    pause,
    resume,
    onDeadlineChange,
  };
}
