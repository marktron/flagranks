import { Signer } from "@aws-sdk/rds-signer";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { Pool, QueryResult, QueryResultRow } from "pg";
import { UN_MEMBER_FLAGS } from "./seed-data";
import { SMOOTHING_K, calculateSmoothedScore, calculateRawWinPct } from "@/lib/scoring";

// Re-export types for backward compatibility
export type { Flag, FlagWithStats, PairingStats } from "@/lib/types";
import type { Flag, FlagWithStats, PairingStats } from "@/lib/types";

// Check if we're running on Vercel (has proper AWS IAM auth via OIDC)
const isVercel = process.env.VERCEL === "1";

// Create pool with appropriate credentials
let pool: Pool | null = null;

// Option 1: Local development with password-based auth (Docker PostgreSQL)
if (process.env.PGPASSWORD || process.env.DATABASE_URL) {
  if (process.env.DATABASE_URL) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  } else {
    pool = new Pool({
      host: process.env.PGHOST || "localhost",
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE || "flagranks",
      port: Number(process.env.PGPORT || 5432),
    });
  }
}
// Option 2: Vercel production with AWS IAM auth
else if (isVercel && process.env.PGHOST && process.env.AWS_ROLE_ARN) {
  const signer = new Signer({
    hostname: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    username: process.env.PGUSER!,
    region: process.env.AWS_REGION!,
    credentials: awsCredentialsProvider({
      roleArn: process.env.AWS_ROLE_ARN,
      clientConfig: { region: process.env.AWS_REGION! },
    }),
  });

  pool = new Pool({
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    database: process.env.PGDATABASE || "postgres",
    password: () => signer.getAuthToken(),
    port: Number(process.env.PGPORT || 5432),
    ssl: { rejectUnauthorized: false },
  });

  // Attach pool for Vercel Functions
  import("@vercel/functions").then(({ attachDatabasePool }) => {
    if (pool) attachDatabasePool(pool);
  }).catch(() => {});
}

// Helper function to run queries
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  if (!pool) {
    throw new Error(
      "Database not available. The AWS PostgreSQL connection only works on Vercel. " +
      "For local development, deploy to Vercel or set up a local PostgreSQL instance."
    );
  }
  return pool.query<T>(text, params);
}

// Re-export calculateSmoothedScore for backward compatibility
export { calculateSmoothedScore, calculateRawWinPct } from "@/lib/scoring";

// Get multiple matchups at once with their current pairing stats
export async function getMatchups(
  count: number = 10,
  excludeIds: number[] = []
): Promise<
  Array<{
    flagA: { id: number; country_name: string; svg_url: string };
    flagB: { id: number; country_name: string; svg_url: string };
    stats: { aVotes: number; bVotes: number; n: number };
  }>
> {
  // Get more flags to ensure we have enough for multiple unique matchups
  const result = await query<{
    id: number;
    country_name: string;
    iso2: string;
    svg_url: string;
    games: number;
  }>(
    `SELECT f.id, f.country_name, f.iso2, f.svg_url,
            COALESCE(fs.games, 0) as games
     FROM flags f
     LEFT JOIN flag_stats fs ON f.id = fs.flag_id
     WHERE f.is_active = true
     ORDER BY COALESCE(fs.games, 0) ASC, RANDOM()
     LIMIT 100`
  );

  // Filter out excluded flags
  const flags = result.rows.filter((f) => !excludeIds.includes(f.id));
  if (flags.length < 2) {
    throw new Error("Not enough flags in database");
  }

  const matchups: Array<{
    flagA: { id: number; country_name: string; svg_url: string };
    flagB: { id: number; country_name: string; svg_url: string };
    stats: { aVotes: number; bVotes: number; n: number };
  }> = [];

  const usedPairs = new Set<string>();

  // Generate unique matchups
  for (let i = 0; i < count && flags.length >= 2; i++) {
    let attempts = 0;
    let flagA: (typeof flags)[0] | null = null;
    let flagB: (typeof flags)[0] | null = null;

    while (attempts < 50) {
      // Pick flagA from bottom quartile (under-sampled)
      const bottomQuartile = flags.slice(0, Math.max(Math.ceil(flags.length / 4), 2));
      flagA = bottomQuartile[Math.floor(Math.random() * bottomQuartile.length)];

      // Pick flagB randomly from remaining flags
      const remaining = flags.filter((f) => f.id !== flagA!.id);
      flagB = remaining[Math.floor(Math.random() * remaining.length)];

      // Check if pair is unique
      const pairKey = [flagA.id, flagB.id].sort((a, b) => a - b).join("-");
      if (!usedPairs.has(pairKey)) {
        usedPairs.add(pairKey);
        break;
      }
      attempts++;
    }

    if (!flagA || !flagB) continue;

    // Randomize order
    if (Math.random() > 0.5) {
      [flagA, flagB] = [flagB, flagA];
    }

    matchups.push({
      flagA: { id: flagA.id, country_name: flagA.country_name, svg_url: flagA.svg_url },
      flagB: { id: flagB.id, country_name: flagB.country_name, svg_url: flagB.svg_url },
      stats: { aVotes: 0, bVotes: 0, n: 0 }, // Will be filled below
    });
  }

  // Fetch pairing stats for all matchups in one query
  if (matchups.length > 0) {
    const pairingIds = matchups.map((m) => {
      const minId = Math.min(m.flagA.id, m.flagB.id);
      const maxId = Math.max(m.flagA.id, m.flagB.id);
      return `${minId}-${maxId}`;
    });

    const statsResult = await query<{
      pairing_id: string;
      a_votes: number;
      b_votes: number;
      n_total: number;
    }>(
      `SELECT pairing_id, a_votes, b_votes, n_total
       FROM votes_agg_pairings
       WHERE pairing_id = ANY($1)`,
      [pairingIds]
    );

    const statsMap = new Map(statsResult.rows.map((r) => [r.pairing_id, r]));

    // Fill in stats for each matchup
    for (const matchup of matchups) {
      const minId = Math.min(matchup.flagA.id, matchup.flagB.id);
      const maxId = Math.max(matchup.flagA.id, matchup.flagB.id);
      const pairingId = `${minId}-${maxId}`;
      const stats = statsMap.get(pairingId);

      if (stats) {
        // Map a/b votes to flagA/flagB based on which is minId
        const flagAIsMin = matchup.flagA.id === minId;
        matchup.stats = {
          aVotes: flagAIsMin ? stats.a_votes : stats.b_votes,
          bVotes: flagAIsMin ? stats.b_votes : stats.a_votes,
          n: stats.n_total,
        };
      }
    }
  }

  return matchups;
}

// Record multiple votes efficiently using a single batch query
export async function recordVotes(
  votes: Array<{ winnerId: number; loserId: number }>
): Promise<{ processed: number }> {
  if (votes.length === 0) return { processed: 0 };

  // Prepare arrays for UNNEST
  const pairingIds: string[] = [];
  const aIds: number[] = [];
  const bIds: number[] = [];
  const aIncrements: number[] = [];
  const bIncrements: number[] = [];
  const winnerIds: number[] = [];
  const loserIds: number[] = [];

  for (const vote of votes) {
    const minId = Math.min(vote.winnerId, vote.loserId);
    const maxId = Math.max(vote.winnerId, vote.loserId);
    pairingIds.push(`${minId}-${maxId}`);
    aIds.push(minId);
    bIds.push(maxId);
    aIncrements.push(vote.winnerId === minId ? 1 : 0);
    bIncrements.push(vote.winnerId === maxId ? 1 : 0);
    winnerIds.push(vote.winnerId);
    loserIds.push(vote.loserId);
  }

  // Single query using CTEs to batch all operations
  await query(
    `
    WITH vote_data AS (
      SELECT
        unnest($1::text[]) as pairing_id,
        unnest($2::int[]) as a_id,
        unnest($3::int[]) as b_id,
        unnest($4::int[]) as a_increment,
        unnest($5::int[]) as b_increment,
        unnest($6::int[]) as winner_id,
        unnest($7::int[]) as loser_id
    ),
    -- Aggregate increments per pairing (handles duplicate pairings in batch)
    pairing_agg AS (
      SELECT
        pairing_id,
        a_id,
        b_id,
        SUM(a_increment)::int as total_a_inc,
        SUM(b_increment)::int as total_b_inc,
        COUNT(*)::int as total_n
      FROM vote_data
      GROUP BY pairing_id, a_id, b_id
    ),
    -- Upsert pairing stats
    upsert_pairings AS (
      INSERT INTO votes_agg_pairings (pairing_id, a_id, b_id, a_votes, b_votes, n_total, updated_at)
      SELECT pairing_id, a_id, b_id, total_a_inc, total_b_inc, total_n, NOW()
      FROM pairing_agg
      ON CONFLICT (pairing_id) DO UPDATE SET
        a_votes = votes_agg_pairings.a_votes + EXCLUDED.a_votes,
        b_votes = votes_agg_pairings.b_votes + EXCLUDED.b_votes,
        n_total = votes_agg_pairings.n_total + EXCLUDED.n_total,
        updated_at = NOW()
    ),
    -- Aggregate flag stats (wins/losses per flag)
    flag_agg AS (
      SELECT flag_id, SUM(wins)::int as wins, SUM(losses)::int as losses
      FROM (
        SELECT winner_id as flag_id, 1 as wins, 0 as losses FROM vote_data
        UNION ALL
        SELECT loser_id as flag_id, 0 as wins, 1 as losses FROM vote_data
      ) sub
      GROUP BY flag_id
    )
    -- Upsert flag stats
    INSERT INTO flag_stats (flag_id, wins, losses, games, updated_at)
    SELECT flag_id, wins, losses, wins + losses, NOW()
    FROM flag_agg
    ON CONFLICT (flag_id) DO UPDATE SET
      wins = flag_stats.wins + EXCLUDED.wins,
      losses = flag_stats.losses + EXCLUDED.losses,
      games = flag_stats.games + EXCLUDED.games,
      updated_at = NOW()
    `,
    [pairingIds, aIds, bIds, aIncrements, bIncrements, winnerIds, loserIds]
  );

  return { processed: votes.length };
}

// Get leaderboard
export async function getLeaderboard(limit = 200): Promise<FlagWithStats[]> {
  const result = await query<{
    id: number;
    country_name: string;
    iso2: string;
    svg_url: string;
    is_active: boolean;
    wins: number;
    losses: number;
    games: number;
  }>(
    `SELECT
       f.id, f.country_name, f.iso2, f.svg_url, f.is_active,
       COALESCE(fs.wins, 0) as wins,
       COALESCE(fs.losses, 0) as losses,
       COALESCE(fs.games, 0) as games
     FROM flags f
     LEFT JOIN flag_stats fs ON f.id = fs.flag_id
     WHERE f.is_active = true
     ORDER BY
       (COALESCE(fs.wins, 0) + $1 * 0.5) / (COALESCE(fs.games, 0) + $1) DESC,
       COALESCE(fs.games, 0) DESC
     LIMIT $2`,
    [SMOOTHING_K, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    country_name: row.country_name,
    iso2: row.iso2,
    svg_url: row.svg_url,
    is_active: row.is_active,
    wins: row.wins,
    losses: row.losses,
    games: row.games,
    smoothed_score: calculateSmoothedScore(row.wins, row.games),
    raw_win_pct: row.games > 0 ? Math.round((row.wins / row.games) * 100) : 50,
  }));
}

// Get flag ID by ISO2 code
export async function getFlagIdByIso2(iso2: string): Promise<number | null> {
  const result = await query<{ id: number }>(
    `SELECT id FROM flags WHERE UPPER(iso2) = UPPER($1) AND is_active = true`,
    [iso2]
  );
  return result.rows[0]?.id ?? null;
}

// Get flag by ISO2 code with stats
export async function getFlagByIso2(iso2: string): Promise<FlagWithStats | null> {
  const result = await query<{
    id: number;
    country_name: string;
    iso2: string;
    svg_url: string;
    is_active: boolean;
    wins: number;
    losses: number;
    games: number;
  }>(
    `SELECT
       f.id, f.country_name, f.iso2, f.svg_url, f.is_active,
       COALESCE(fs.wins, 0) as wins,
       COALESCE(fs.losses, 0) as losses,
       COALESCE(fs.games, 0) as games
     FROM flags f
     LEFT JOIN flag_stats fs ON f.id = fs.flag_id
     WHERE LOWER(f.iso2) = LOWER($1) AND f.is_active = true`,
    [iso2]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    country_name: row.country_name,
    iso2: row.iso2,
    svg_url: row.svg_url,
    is_active: row.is_active,
    wins: row.wins,
    losses: row.losses,
    games: row.games,
    smoothed_score: calculateSmoothedScore(row.wins, row.games),
    raw_win_pct: row.games > 0 ? Math.round((row.wins / row.games) * 100) : 50,
  };
}

// Get flag's rank in leaderboard
export async function getFlagRank(flagId: number): Promise<number | null> {
  const result = await query<{ rank: number }>(
    `SELECT rank FROM (
       SELECT f.id,
              ROW_NUMBER() OVER (
                ORDER BY (COALESCE(fs.wins, 0) + $1 * 0.5) / (COALESCE(fs.games, 0) + $1) DESC,
                         COALESCE(fs.games, 0) DESC
              ) as rank
       FROM flags f
       LEFT JOIN flag_stats fs ON f.id = fs.flag_id
       WHERE f.is_active = true
     ) ranked
     WHERE id = $2`,
    [SMOOTHING_K, flagId]
  );
  return result.rows[0]?.rank ?? null;
}

// Get single flag details
export async function getFlagById(id: number): Promise<FlagWithStats | null> {
  const result = await query<{
    id: number;
    country_name: string;
    iso2: string;
    svg_url: string;
    is_active: boolean;
    wins: number;
    losses: number;
    games: number;
  }>(
    `SELECT
       f.id, f.country_name, f.iso2, f.svg_url, f.is_active,
       COALESCE(fs.wins, 0) as wins,
       COALESCE(fs.losses, 0) as losses,
       COALESCE(fs.games, 0) as games
     FROM flags f
     LEFT JOIN flag_stats fs ON f.id = fs.flag_id
     WHERE f.id = $1`,
    [id]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    country_name: row.country_name,
    iso2: row.iso2,
    svg_url: row.svg_url,
    is_active: row.is_active,
    wins: row.wins,
    losses: row.losses,
    games: row.games,
    smoothed_score: calculateSmoothedScore(row.wins, row.games),
    raw_win_pct: row.games > 0 ? Math.round((row.wins / row.games) * 100) : 50,
  };
}

// Seed the database with UN member flags
export async function seedDatabase() {
  // Create tables
  await query(`
    CREATE TABLE IF NOT EXISTS flags (
      id SERIAL PRIMARY KEY,
      country_name VARCHAR(100) NOT NULL,
      iso2 CHAR(2) NOT NULL UNIQUE,
      svg_url VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS flag_stats (
      flag_id INTEGER PRIMARY KEY REFERENCES flags(id),
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      games INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS votes_agg_pairings (
      pairing_id VARCHAR(20) PRIMARY KEY,
      a_id INTEGER NOT NULL REFERENCES flags(id),
      b_id INTEGER NOT NULL REFERENCES flags(id),
      a_votes INTEGER DEFAULT 0,
      b_votes INTEGER DEFAULT 0,
      n_total INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await query(`CREATE INDEX IF NOT EXISTS idx_flag_stats_games ON flag_stats(games)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_flags_active ON flags(is_active)`);

  // Insert flags
  for (const flag of UN_MEMBER_FLAGS) {
    await query(
      `INSERT INTO flags (country_name, iso2, svg_url, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (iso2) DO NOTHING`,
      [flag.country_name, flag.iso2, `/flags/${flag.iso2}.svg`]
    );
  }

  return { success: true, count: UN_MEMBER_FLAGS.length };
}
