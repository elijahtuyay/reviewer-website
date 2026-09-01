/**
 * The element that most recently held focus, tracked continuously.
 *
 * Every overlay in this app (PauseOverlay, ConfirmDialog, MobileNavSheet) needs
 * to hand focus back to whatever opened it when it closes — WCAG 2.4.3. The
 * obvious implementation, `document.activeElement` read inside the overlay's
 * open effect, silently does nothing here, and it took a keyboard pass to catch
 * because it LOOKS correct:
 *
 *   React applies every DOM mutation for a commit before it runs passive
 *   effects. The commit that opens an overlay is the same commit that puts
 *   `inert` on the quiz wrapper (FreeFormRunner / SequentialRunner), and the
 *   spec says a focused element becoming inert resets focus to <body>. So by
 *   the time the effect samples `document.activeElement`, the trigger is long
 *   gone and the overlay dutifully restores focus to <body>.
 *
 * The visible symptom: pause with the keyboard, resume, and the next Tab starts
 * over from the skip link at the top of the page instead of continuing from the
 * Pause button. A layout effect does not help — mutations still run first.
 *
 * Tracking `focusin` instead sidesteps the ordering entirely. Focus moving AWAY
 * fires `focusout`, not `focusin`, and the implicit reset to <body> is filtered
 * out below, so the last real control the user touched survives the inert
 * transition and is still here to read.
 *
 * Capture this at open time into a ref, the way the overlays do — do not read
 * it at close time, since by then the overlay has focused its own button and
 * that is what would be recorded.
 */

let lastFocused: HTMLElement | null = null;

if (typeof document !== "undefined") {
  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target as HTMLElement | null;
      // <body> is what the browser falls back to when the focused element is
      // removed, hidden or made inert. Recording it would overwrite the trigger
      // with the very reset this module exists to survive.
      if (!target || target === document.body) return;
      lastFocused = target;
    },
    // Capture phase: focusin bubbles, but listening at capture means a stray
    // stopPropagation in application code can never blind the tracker.
    true
  );
}

/**
 * The last element that genuinely held focus, or null.
 *
 * Returns null for an element that has since left the document, so a caller
 * never tries to focus a node React has already unmounted.
 */
export function getLastFocused(): HTMLElement | null {
  if (!lastFocused) return null;
  if (!lastFocused.isConnected) return null;
  return lastFocused;
}

/**
 * Focus `element` if it is still on the page and still focusable.
 *
 * Overlays call this on close. Silently does nothing otherwise, which is the
 * right outcome: the alternative is throwing on teardown, and a trigger that
 * unmounted while the overlay was open (Retake, say, which replaces the header)
 * has no sensible focus target to return to.
 */
export function restoreFocus(element: HTMLElement | null | undefined) {
  if (!element || !element.isConnected) return;
  element.focus?.();
}
