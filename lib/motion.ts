/**
 * The reduced-motion preference, for the motion CSS cannot reach.
 *
 * `globals.css` collapses every transition and animation under
 * `prefers-reduced-motion: reduce`, which covers the whole app except for
 * motion requested from JavaScript. `scrollIntoView({ behavior: "smooth" })` is
 * the case that matters here: clicking a cell in the progress grid smooth
 * scrolls across a 36-question page, which is by a wide margin the largest
 * motion event in the app, and no media query can turn it off — the option has
 * to be chosen at the call site. (`scroll-behavior: auto !important` in the
 * reduced-motion block only overrides CSS-driven scrolling, not an explicit
 * `behavior` argument, which wins.)
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** `scrollIntoView` options that honor the preference. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}
