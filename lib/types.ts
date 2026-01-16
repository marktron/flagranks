// ============================================
// Core Domain Types
// ============================================

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

// ============================================
// Matchup Types
// ============================================

export interface MatchupFlag {
  id: number;
  svg_url: string;
  country_name: string;
}

export interface MatchupStats {
  aVotes: number;
  bVotes: number;
  n: number;
}

export interface Matchup {
  a: MatchupFlag;
  b: MatchupFlag;
  matchupId: string;
  stats: MatchupStats;
}

// ============================================
// API Request/Response Types
// ============================================

export interface MatchupsResponse {
  userFlagId: number | null;
  matchups: Matchup[];
}

export interface VotePayload {
  winnerId: number;
  loserId: number;
}

export interface VotesRequest {
  votes: VotePayload[];
}

export interface VotesResponse {
  processed: number;
}

export interface LeaderboardResponse {
  flags: FlagWithStats[];
  total: number;
}

// ============================================
// Client-Side Types
// ============================================

export interface OptimisticResult {
  aName: string;
  bName: string;
  aPct: number;
  bPct: number;
  n: number;
  winnerId: number;
}

export interface PendingVote {
  winnerId: number;
  loserId: number;
}
