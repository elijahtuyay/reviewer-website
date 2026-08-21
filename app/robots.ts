import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Quiz routes are deliberately excluded: they render nothing server-side (the
 * page is a client component that draws a random question set after hydration),
 * so a crawler only ever sees an empty shell. Indexing them would spend crawl
 * budget on blank pages and put URLs in search results that make no sense to
 * land on cold.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/*/quiz/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
