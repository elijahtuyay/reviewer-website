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
    <div key={pathname} className="page-transition flex flex-1 flex-col">
      {children}
    </div>
  );
}
