import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Nothing is disallowed here on purpose. Quiz routes must stay out of the
 * index — they render nothing server-side, so a crawler only ever sees an empty
 * shell, and a search result that drops a stranger mid-attempt is worse than no
 * result. But a `Disallow` is the wrong tool for that: a crawler that never
 * fetches the page never reads its `noindex`, which leaves the URL eligible for
 * URL-only indexing from any inbound link. The quiz layout sends `noindex,
 * follow` instead, and this file lets crawlers reach it.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
