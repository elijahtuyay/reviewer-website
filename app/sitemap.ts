import type { MetadataRoute } from "next";
import { EXAM_LIST } from "@/lib/exams/registry";
import { SITE_URL } from "@/lib/site";

/**
 * Only pages that render real server-side content AND are indexable: the home
 * page, plus the setup page of each exam that actually has a question bank.
 *
 * Quiz routes are excluded because they are client-rendered and marked
 * noindex. Unavailable exams are excluded for the same reason: their setup page
 * is noindex too (see app/[examId]/page.tsx), and listing a noindex URL in the
 * sitemap is what Search Console reports as "Submitted URL marked 'noindex'".
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...EXAM_LIST.filter((exam) => exam.available)
      .map((exam) => ({
        url: `${SITE_URL}/${exam.id}`,
        changeFrequency: "monthly" as const,
        priority: 0.8,
      })),
  ];
}
