import { unstable_cache } from "next/cache";
import { query } from "./index";

export interface CachedFlag {
  id: number;
  country_name: string;
  svg_url: string;
  games: number;
}

/**
 * Get cached flag pool for server-side matchup generation.
 * Uses Next.js unstable_cache with 5-minute revalidation.
 *
 * Key optimization: No ORDER BY RANDOM() in SQL - this makes the query cacheable.
 * Randomization happens in-memory after fetching from cache.
 */
export const getCachedFlagPool = unstable_cache(
  async (): Promise<CachedFlag[]> => {
    const result = await query<{
      id: number;
      country_name: string;
      svg_url: string;
      games: number;
    }>(
      `SELECT f.id, f.country_name, f.svg_url, COALESCE(fs.games, 0) as games
       FROM flags f
       LEFT JOIN flag_stats fs ON f.id = fs.flag_id
       WHERE f.is_active = true
       ORDER BY COALESCE(fs.games, 0) ASC
       LIMIT 100`
    );
    return result.rows;
  },
  ["flag-pool"],
  { revalidate: 300 } // 5 minutes
);
