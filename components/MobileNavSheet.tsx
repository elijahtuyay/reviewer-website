"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getLastFocused, restoreFocus } from "@/lib/last-focused";

interface MobileNavSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/** Must match the exit `duration-200` on the sheet below: it stays mounted this long after closing so the transition can play out. */
const EXIT_DURATION_MS = 200;

/**
 * Mobile-only stand-in for the desktop sidebar (SectionNav + ProgressTracker),
 * which is hidden below `lg` — without this, section switching and the
 * per-question jump grid would be entirely unreachable on phones/tablets.
 *
 * Containment mirrors ConfirmDialog rather than reinventing it: dialog
 * semantics, initial focus, a Tab trap, Escape, body scroll lock, and focus
 * returned to the trigger. An earlier note claimed the trap was added when this
 * was first built; only Escape and the scroll lock ever were. The gap was real:
 * the "Sections" button lives inside the runner's `inert` wrapper, so opening
 * the sheet blurred it to <body> and Tab then walked SiteHeader's links — the
 * whole page behind an aria-modal dialog — before ever reaching the sheet.
 */
export default function MobileNavSheet({ open, onClose, children }: MobileNavSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [stillExiting, setStillExiting] = useState(false);
  const hasOpenedRef = useRef(false);
  // Callers pass an inline arrow, so onClose is a new function every parent
  // render. Depending on it directly would tear down and re-run the effect on
  // any re-render — and this sheet re-renders on every answer, since its
  // children carry the live progress grid. That would yank focus back to Close
  // mid-interaction and re-lock the body.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    // getLastFocused(), not document.activeElement — the trigger is inside the
    // runner's inert wrapper and has already been blurred to <body> by the time
    // this effect runs. See lib/last-focused.ts.
    triggerRef.current = getLastFocused();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      // Unlike ConfirmDialog's fixed two buttons, the sheet's contents are
      // whatever the runner passes in — a section nav plus up to 36 jump cells —
      // so the trap has to be computed from the live DOM each time.
      const sheet = sheetRef.current;
      if (!sheet) return;
      const focusable = Array.from(
        sheet.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      // Wrap at the ends, and pull focus back in if it has escaped the sheet
      // entirely (which is what happens on the very first Tab, since the sheet
      // is the last thing in the DOM and focus starts outside it).
      if (!sheet.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocus(triggerRef.current);
    };
  }, [open]);

  // Keeps the sheet mounted through its exit transition. Guarded on having
  // actually been open, so it does not hold an aria-modal dialog in the tree for
  // 200ms on every quiz page load — the same first-mount trap PauseOverlay
  // documents.
  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
      return;
    }
    if (!hasOpenedRef.current) return;
    setStillExiting(true);
    const timeout = setTimeout(() => setStillExiting(false), EXIT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  if (!open && !stillExiting) return null;

  return (
    <div className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`}>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 ${open ? "backdrop-in" : "backdrop-out"}`}
      />
      {/*
        bg-panel, not bg-background: the sheet used to be the same color as the
        page behind it, separated only by a 1px --line border (1.62:1 in dark)
        and a scrim over an already near-black page, so in dark mode it barely
        read as a separate surface. Panel plus a shadow gives it an edge at both
        themes, and matches ConfirmDialog.

        The slide is a @keyframes animation rather than a transition -- see the
        note in globals.css. A transition here silently did nothing on open,
        because the sheet is inserted already carrying its open classes and so
        has no from-state to interpolate. Transform and opacity only, so it
        composites rather than triggering layout.
      */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        // Same reasoning as PauseOverlay: an aria-modal dialog claims the rest
        // of the document is hidden, so it must not linger in the tree through
        // the exit transition while the page behind it is live again.
        inert={!open || undefined}
        aria-hidden={!open || undefined}
        className={`absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-xl border-t border-line bg-panel p-4 pb-8 shadow-lg ${
          open ? "sheet-in" : "sheet-out"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <p id={titleId} className="text-sm font-medium text-foreground">
            Section &amp; progress
          </p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            // Untabbable while exiting, so the 200ms window can't park focus on
            // a control that is invisible and on its way out (matches
            // PauseOverlay's Resume).
            tabIndex={open ? 0 : -1}
            className="flex h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm text-muted transition-colors hover:bg-panel-hover hover:text-foreground active:bg-panel-hover"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
