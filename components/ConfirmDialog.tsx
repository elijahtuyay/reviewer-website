"use client";

import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Says specifically what is about to be lost. Never a generic "are you sure?". */
  body: string;
  /** Label for the confirming action, phrased as the verb it performs ("Submit section", not "OK"). */
  confirmLabel: string;
  cancelLabel?: string;
  /**
   * "destructive" when confirming discards work. It moves the accent (and the
   * visual weight that goes with it) onto the SAFE button, so the eye-catching
   * one is the one that keeps your work.
   */
  tone?: "primary" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared confirmation step for the actions that can destroy a user's work:
 * submitting with unanswered questions, restarting a section, and clearing saved
 * progress. Built rather than using window.confirm() so it matches the rest of
 * the UI and can be made accessible; centralised so a fourth destructive action
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
  tone = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
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

    const previouslyFocused = document.activeElement as HTMLElement | null;
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
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const destructive = tone === "destructive";
  const confirmClasses = destructive
    ? "border border-red-600 text-red-700 hover:bg-red-50 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-950/40"
    : "bg-accent text-accent-foreground hover:opacity-90";
  const cancelClasses = destructive
    ? "bg-accent text-accent-foreground hover:opacity-90"
    : "border border-line text-foreground hover:bg-panel-hover";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={cancelLabel}
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        className="relative w-full max-w-sm rounded-lg border border-line bg-background p-5 shadow-lg"
      >
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-foreground">
          {title}
        </h2>
        <p id="confirm-dialog-body" className="mt-2 text-sm leading-relaxed text-foreground/90">
          {body}
        </p>
        {/* DOM order is cancel-then-confirm, which reads as [Cancel] [Confirm]
            on a wide screen. flex-col-reverse stacks them on narrow screens with
            the safe choice at the bottom, nearest the thumb. */}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={`flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium ${cancelClasses}`}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
