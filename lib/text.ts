/**
 * Text helpers shared by copy that is generated rather than written out.
 *
 * `joinWithAnd` exists because the same three lines were written twice and the
 * second copy was wrong: `app/[examId]/page.tsx` had `listSections()` for the
 * calculator bullet, while `app/layout.tsx` used a plain `.join(" and ")` that
 * would render "the NMAT and the GMAT and the GRE" the day a third exam lands.
 * The registry is the reason this app has almost no hand-written copy left, so
 * a list built from the registry should not be the place a hand-written bug
 * reappears.
 */

/** "A", "A and B", "A, B and C". Serial comma omitted, matching the app's voice. */
export function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
