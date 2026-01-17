import { unstable_cache } from "next/cache";
import { query } from "./index";

export interface CachedFlag {
  id: number;
  country_name: string;
  svg_url: string;
}

/**
 * Get cached flag list for client-side matchup generation.
 * Uses Next.js unstable_cache with 5-minute revalidation.
 */
export const getCachedFlagPool = unstable_cache(
  async (): Promise<CachedFlag[]> => {
    const result = await query<{
      id: number;
      country_name: string;
      svg_url: string;
    }>(
      `SELECT id, country_name, svg_url
       FROM flags
       WHERE is_active = true`
    );
    return result.rows;
  },
  ["flag-pool"],
  { revalidate: 300 } // 5 minutes
);
