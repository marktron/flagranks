import { getCachedFlagPool, type CachedFlag } from "@/lib/db/cached-flags";
import type { Matchup } from "@/lib/types";

/**
 * Fisher-Yates shuffle for in-memory randomization
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate initial matchups server-side from cached flag pool.
 *
 * This runs on the server during ISR, generating matchups without
 * a database query (uses cached flag pool instead).
 *
 * @param count Number of matchups to generate
 * @returns Array of Matchup objects ready for VotingScreen
 */
export async function generateInitialMatchups(count: number = 10): Promise<Matchup[]> {
  let flags: CachedFlag[];

  try {
    flags = await getCachedFlagPool();
  } catch {
    // If database is unavailable (local dev), return empty array
    // VotingScreen will show the "Database Not Connected" state
    return [];
  }

  if (flags.length < 2) {
    return [];
  }

  const matchups: Matchup[] = [];
  const usedPairs = new Set<string>();

  // Shuffle flags for random selection
  const shuffledFlags = shuffle(flags);

  for (let i = 0; i < count && shuffledFlags.length >= 2; i++) {
    let attempts = 0;
    let flagA: CachedFlag | null = null;
    let flagB: CachedFlag | null = null;

    while (attempts < 50) {
      // Pick flagA from bottom quartile (under-sampled flags)
      const bottomQuartile = shuffledFlags.slice(
        0,
        Math.max(Math.ceil(shuffledFlags.length / 4), 2)
      );
      flagA = bottomQuartile[Math.floor(Math.random() * bottomQuartile.length)];

      // Pick flagB randomly from remaining flags
      const remaining = shuffledFlags.filter((f) => f.id !== flagA!.id);
      flagB = remaining[Math.floor(Math.random() * remaining.length)];

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
      // Start with zero stats - optimistic updates will handle accuracy after voting
      stats: { aVotes: 0, bVotes: 0, n: 0 },
    });
  }

  return matchups;
}
