"use client";

import { usePathname } from "next/navigation";

/**
 * Remounting a keyed element on every pathname change retriggers its CSS
 * animation, giving every route change a consistent fade/rise instead of an
 * abrupt content swap. SiteHeader lives outside this wrapper (in the root
 * layout) so it stays put across navigations rather than re-animating too.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    // tabIndex={-1} so the "Skip to content" link in the root layout can move
    // focus here, not just scroll to it. -1 keeps it out of the normal tab
    // order; without it the browser would scroll but leave focus in the header,
    // so the next Tab would drop back into the nav the user just skipped.
    <div
      key={pathname}
      id="main-content"
      tabIndex={-1}
      className="page-transition flex flex-1 flex-col outline-none"
    >
      {children}
    </div>
  );
}
