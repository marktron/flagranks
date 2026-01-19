import { getCachedFlagPool, type CachedFlag } from "@/lib/db/cached-flags";
import type { Matchup } from "@/lib/types";
import { generateMatchupToken } from "./tokens";

/**
 * Generate initial matchups server-side from cached flag pool.
 * Uses fully random selection for better variety.
 */
export async function generateInitialMatchups(count: number = 50): Promise<Matchup[]> {
  let flags: CachedFlag[];

  try {
    flags = await getCachedFlagPool();
  } catch {
    // If database is unavailable (local dev), return empty array
    return [];
  }

  if (flags.length < 2) {
    return [];
  }

  const matchups: Matchup[] = [];
  const usedPairs = new Set<string>();

  for (let i = 0; i < count && flags.length >= 2; i++) {
    let attempts = 0;
    let flagA: CachedFlag | null = null;
    let flagB: CachedFlag | null = null;

    while (attempts < 50) {
      // Pick two random flags
      const idxA = Math.floor(Math.random() * flags.length);
      let idxB = Math.floor(Math.random() * (flags.length - 1));
      if (idxB >= idxA) idxB++;

      flagA = flags[idxA];
      flagB = flags[idxB];

      // Check if pair is unique within this batch
      const pairKey = [flagA.id, flagB.id].sort((a, b) => a - b).join("-");
      if (!usedPairs.has(pairKey)) {
        usedPairs.add(pairKey);
        break;
      }
      attempts++;
    }

    if (!flagA || !flagB) continue;

    // Randomize left/right position
    if (Math.random() > 0.5) {
      [flagA, flagB] = [flagB, flagA];
    }

    const matchupId = `${Math.min(flagA.id, flagB.id)}-${Math.max(flagA.id, flagB.id)}`;

    matchups.push({
      a: {
        id: flagA.id,
        svg_url: flagA.svg_url,
        country_name: flagA.country_name,
      },
      b: {
        id: flagB.id,
        svg_url: flagB.svg_url,
        country_name: flagB.country_name,
      },
      matchupId,
      token: generateMatchupToken(matchupId),
      stats: { aVotes: 0, bVotes: 0, n: 0 },
    });
  }

  return matchups;
}
