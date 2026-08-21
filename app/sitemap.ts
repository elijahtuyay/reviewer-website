import type { MetadataRoute } from "next";
import { EXAMS } from "@/lib/exam-config";
import { SITE_URL } from "@/lib/site";

/**
 * Only the pages that render real server-side content: the home page and each
 * exam's setup page. Quiz routes are client-rendered and excluded here for the
 * same reason robots.ts disallows them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...Object.values(EXAMS).map((exam) => ({
      url: `${SITE_URL}/${exam.id}`,
      changeFrequency: "monthly" as const,
      // An exam with no question bank yet is a placeholder page, not a
      // destination — kept in the sitemap so it is discoverable, ranked low so
      // it never outranks a real one.
      priority: exam.available ? 0.8 : 0.3,
    })),
  ];
}
