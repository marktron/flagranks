import { Signer } from "@aws-sdk/rds-signer";
import { awsCredentialsProvider } from "@vercel/oidc-aws-credentials-provider";
import { Pool, QueryResult, QueryResultRow } from "pg";
import { UN_MEMBER_FLAGS } from "./seed-data";

// Bayesian smoothing constant
const SMOOTHING_K = 10;

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
async function query<T extends QueryResultRow = QueryResultRow>(
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

export interface Flag {
  id: number;
  country_name: string;
  iso2: string;
  svg_url: string;
  is_active: boolean;
}

export interface FlagWithStats extends Flag {
  wins: number;
  losses: number;
  games: number;
  smoothed_score: number;
  raw_win_pct: number;
}

export interface PairingStats {
  a_votes: number;
  b_votes: number;
  n_total: number;
  a_pct: number;
  b_pct: number;
}

// Calculate smoothed score using Bayesian smoothing
export function calculateSmoothedScore(wins: number, games: number): number {
  return (wins + SMOOTHING_K * 0.5) / (games + SMOOTHING_K);
}

// Get a random matchup, prioritizing under-sampled flags
export async function getMatchup(excludeIds: number[] = []) {
  // Get flags with their game counts, prioritizing those with fewer games
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
     LIMIT 50`
  );

  // Filter out excluded flags (e.g., user's own country)
  const flags = result.rows.filter((f) => !excludeIds.includes(f.id));
  if (flags.length < 2) {
    throw new Error("Not enough flags in database");
  }

  // Pick flag_a from bottom quartile (under-sampled)
  const bottomQuartile = flags.slice(0, Math.max(Math.ceil(flags.length / 4), 2));
  const flagA = bottomQuartile[Math.floor(Math.random() * bottomQuartile.length)];

  // Pick flag_b randomly from remaining flags
  const remaining = flags.filter((f) => f.id !== flagA.id);

  if (remaining.length === 0) {
    throw new Error("Not enough flags for matchup");
  }

  const flagB = remaining[Math.floor(Math.random() * remaining.length)];

  // Randomize order so flag_a isn't always on left
  if (Math.random() > 0.5) {
    return { flagA: flagB, flagB: flagA };
  }

  return { flagA, flagB };
}

// Record a vote and return updated stats
export async function recordVote(
  winnerId: number,
  loserId: number
): Promise<{
  pairing: PairingStats;
  winner: { id: number; country_name: string; smoothed_score: number };
  loser: { id: number; country_name: string; smoothed_score: number };
}> {
  // Create pairing ID (always minId-maxId for consistency)
  const minId = Math.min(winnerId, loserId);
  const maxId = Math.max(winnerId, loserId);
  const pairingId = `${minId}-${maxId}`;
  const winnerIsA = winnerId === minId;

  // Upsert pairing votes
  if (winnerIsA) {
    await query(
      `INSERT INTO votes_agg_pairings (pairing_id, a_id, b_id, a_votes, b_votes, n_total, updated_at)
       VALUES ($1, $2, $3, 1, 0, 1, NOW())
       ON CONFLICT (pairing_id) DO UPDATE SET
         a_votes = votes_agg_pairings.a_votes + 1,
         n_total = votes_agg_pairings.n_total + 1,
         updated_at = NOW()`,
      [pairingId, minId, maxId]
    );
  } else {
    await query(
      `INSERT INTO votes_agg_pairings (pairing_id, a_id, b_id, a_votes, b_votes, n_total, updated_at)
       VALUES ($1, $2, $3, 0, 1, 1, NOW())
       ON CONFLICT (pairing_id) DO UPDATE SET
         b_votes = votes_agg_pairings.b_votes + 1,
         n_total = votes_agg_pairings.n_total + 1,
         updated_at = NOW()`,
      [pairingId, minId, maxId]
    );
  }

  // Update winner stats
  await query(
    `INSERT INTO flag_stats (flag_id, wins, losses, games, updated_at)
     VALUES ($1, 1, 0, 1, NOW())
     ON CONFLICT (flag_id) DO UPDATE SET
       wins = flag_stats.wins + 1,
       games = flag_stats.games + 1,
       updated_at = NOW()`,
    [winnerId]
  );

  // Update loser stats
  await query(
    `INSERT INTO flag_stats (flag_id, wins, losses, games, updated_at)
     VALUES ($1, 0, 1, 1, NOW())
     ON CONFLICT (flag_id) DO UPDATE SET
       losses = flag_stats.losses + 1,
       games = flag_stats.games + 1,
       updated_at = NOW()`,
    [loserId]
  );

  // Get updated pairing stats
  const pairingResult = await query<{ a_votes: number; b_votes: number; n_total: number }>(
    `SELECT a_votes, b_votes, n_total FROM votes_agg_pairings WHERE pairing_id = $1`,
    [pairingId]
  );
  const pairing = pairingResult.rows[0];
  const pairingStats: PairingStats = {
    a_votes: pairing.a_votes,
    b_votes: pairing.b_votes,
    n_total: pairing.n_total,
    a_pct: Math.round((pairing.a_votes / pairing.n_total) * 100),
    b_pct: Math.round((pairing.b_votes / pairing.n_total) * 100),
  };

  // Get updated flag stats
  const flagsResult = await query<{
    id: number;
    country_name: string;
    wins: number;
    games: number;
  }>(
    `SELECT f.id, f.country_name, COALESCE(fs.wins, 0) as wins, COALESCE(fs.games, 0) as games
     FROM flags f
     LEFT JOIN flag_stats fs ON f.id = fs.flag_id
     WHERE f.id = $1 OR f.id = $2`,
    [winnerId, loserId]
  );

  const winner = flagsResult.rows.find((f) => f.id === winnerId)!;
  const loser = flagsResult.rows.find((f) => f.id === loserId)!;

  return {
    pairing: pairingStats,
    winner: {
      id: winner.id,
      country_name: winner.country_name,
      smoothed_score: calculateSmoothedScore(winner.wins, winner.games),
    },
    loser: {
      id: loser.id,
      country_name: loser.country_name,
      smoothed_score: calculateSmoothedScore(loser.wins, loser.games),
    },
  };
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
