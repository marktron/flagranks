import type { MetadataRoute } from "next";
import { UN_MEMBER_FLAGS } from "@/lib/db/seed-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://flagranks.com";

  // Core pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.8,
    },
  ];

  // Individual flag pages
  const flagPages: MetadataRoute.Sitemap = UN_MEMBER_FLAGS.map((flag) => ({
    url: `${baseUrl}/flags/${flag.iso2}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...flagPages];
}
