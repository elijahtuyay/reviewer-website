"use client";

import { useEffect, useId, useRef } from "react";
import { getLastFocused, restoreFocus } from "@/lib/last-focused";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Says specifically what is about to be lost. Never a generic "are you sure?". */
  body: string;
  /** Label for the confirming action, phrased as the verb it performs ("Submit section", not "OK"). */
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared confirmation step for the actions that can destroy a user's work:
 * submitting with unanswered questions, restarting a section, and clearing saved
 * progress. Built rather than using window.confirm() so it matches the rest of
 * the UI and can be made accessible; centralized so a fourth destructive action
 * gets the same treatment for free.
 *
 * Containment lives HERE rather than in each caller: Escape to dismiss, body
 * scroll lock, backdrop cancels, and a Tab trap between the two buttons. The
 * quiz page happens to also mark its content `inert`, but the exam-setup page
 * does not, so relying on callers to remember would leave keyboard users able to
 * tab out of the dialog and act on the page behind it. Cancel takes focus on
 * open, so a stray Enter keeps your work; focus returns to whatever opened the
 * dialog when it closes.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Unique per instance, so a second dialog on a page can't collide on ids.
  const titleId = useId();
  const bodyId = useId();
  // Callers pass inline arrows, so `onCancel` is a new function every parent
  // render. Depending on it directly would tear down and re-run the effect below
  // on any parent re-render, yanking focus back to Cancel even after the user
  // had tabbed to Confirm. Held in a ref so the effect runs once per open.
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;

    // getLastFocused(), NOT document.activeElement. On the quiz page the commit
    // that opens this dialog also marks the runner `inert`, and DOM mutations
    // land before passive effects, so activeElement has already been reset to
    // <body> and restoring it would be a no-op. See lib/last-focused.ts. (This
    // read looked correct because it IS correct on the exam-setup page, which
    // marks nothing inert — which is how it survived review.)
    const previouslyFocused = getLastFocused();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancelRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      // The dialog has exactly two focusable controls, so trapping Tab is just a
      // toggle between them: Tab and Shift+Tab both move to "the other one",
      // and focus can never leave the dialog for the page behind it.
      const cancel = cancelRef.current;
      const confirm = confirmRef.current;
      if (!cancel || !confirm) return;
      e.preventDefault();
      (document.activeElement === cancel ? confirm : cancel).focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocus(previouslyFocused);
    };
  }, [open]);

  if (!open) return null;

  // One color convention, always: accent green is the button that KEEPS your
  // work, the red outline is the irreversible one. Deliberately not
  // configurable. Every action this dialog guards is irreversible, and a
  // per-call "tone" meant green confirmed one dialog and canceled another a
  // single tap apart, which is worse than either convention on its own.
  //
  // The red outline is gone, and this narrows a decision that had been left
  // open. Keeping the accent on Cancel is deliberate and stays (green = keeps
  // your work; the confirming action is the irreversible one). But red is the
  // color this app uses for a WRONG ANSWER, and two independent reviewers read
  // the confirm button as an error state rather than as the thing they had just
  // asked for. Submitting a section is irreversible, not a mistake. A neutral
  // outline keeps the hierarchy without the false alarm.
  const confirmClasses =
    "border border-line-strong text-foreground hover:bg-panel-hover active:bg-line";
  const cancelClasses = "bg-accent text-accent-foreground hover:opacity-90";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* aria-label "Close" rather than the cancel label: this is the dismiss
          backdrop, and naming it "Keep my answers" put a second, invisible
          button by that name in the accessibility tree. Matches PauseOverlay. */}
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onCancel}
        className="backdrop-in absolute inset-0 bg-black/40"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="dialog-in relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-lg border border-line bg-background p-5 shadow-lg"
      >
        <h2 id={titleId} className="text-base font-semibold text-foreground">
          {title}
        </h2>
        <p id={bodyId} className="mt-2 text-sm leading-relaxed text-foreground/90">
          {body}
        </p>
        {/* Plain flex-col on narrow screens, not flex-col-reverse: reversing
            made the visually-last button the first in tab order (WCAG 2.4.3).
            Visual order now matches DOM order at every width. */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={`flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition active:scale-[0.98] ${cancelClasses}`}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition active:scale-[0.98] ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
