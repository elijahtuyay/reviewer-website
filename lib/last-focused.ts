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

function record(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  // <body> is what the browser falls back to when the focused element is
  // removed, hidden or made inert. Recording it would overwrite the trigger
  // with the very reset this module exists to survive.
  if (!el || el === document.body || typeof el.closest !== "function") return;
  lastFocused = el;
}

if (typeof document !== "undefined") {
  // Capture phase throughout: these events bubble, but listening at capture
  // means a stray stopPropagation in application code cannot blind the tracker.
  document.addEventListener("focusin", (event) => record(event.target), true);

  /*
   * Pointer presses are tracked too, and this is not redundant.
   *
   * Safari and Firefox on macOS do not focus a <button> on mousedown, so
   * clicking "Pause" fires no focusin at all and `lastFocused` still holds
   * whatever was focused before — an answer option the user had keyboard-
   * selected minutes earlier. Resuming then threw focus back to that option and
   * scrolled the page to it. On the mobile sheet, whose primary platform is
   * exactly those browsers, it could also steal the scroll from a jump.
   *
   * `closest` walks to the nearest actual control, because the press target is
   * usually a span or an svg inside the button.
   */
  document.addEventListener(
    "pointerdown",
    (event) => {
      const el = event.target as HTMLElement | null;
      if (!el || typeof el.closest !== "function") return;
      const control = el.closest<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (control) record(control);
    },
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
 * Overlays call this on close. When the trigger has unmounted in the meantime,
 * focus moves to the page's main region instead of being left where it fell.
 */
export function restoreFocus(element: HTMLElement | null | undefined) {
  if (element && element.isConnected) {
    // preventScroll: the element is where the user already was, so the browser
    // scrolling to "reveal" it only ever jerks the page.
    element.focus?.({ preventScroll: true });
    return;
  }

  /*
   * The trigger is gone. Falling back to the page's main region rather than
   * doing nothing, because "do nothing" leaves focus on <body> — which is the
   * exact WCAG 2.4.3 failure this module exists to prevent, just reached by a
   * different route.
   *
   * It is reachable on a real path: in review mode, Retake sits in the header,
   * and confirming it moves the attempt back to `taking`, which replaces that
   * header. The button that opened the dialog no longer exists by the time the
   * dialog restores focus.
   */
  const main = document.getElementById("main-content");
  main?.focus?.({ preventScroll: true });
}
