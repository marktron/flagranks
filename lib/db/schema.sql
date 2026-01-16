-- FlagRanks Database Schema

-- Flags table: stores all UN member country flags
CREATE TABLE IF NOT EXISTS flags (
  id SERIAL PRIMARY KEY,
  country_name VARCHAR(100) NOT NULL,
  iso2 CHAR(2) NOT NULL UNIQUE,
  svg_url VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flag stats: aggregated win/loss statistics per flag
CREATE TABLE IF NOT EXISTS flag_stats (
  flag_id INTEGER PRIMARY KEY REFERENCES flags(id),
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  games INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Votes aggregate by pairing: tracks vote totals for each flag pair
CREATE TABLE IF NOT EXISTS votes_agg_pairings (
  pairing_id VARCHAR(20) PRIMARY KEY, -- format: "minId-maxId"
  a_id INTEGER NOT NULL REFERENCES flags(id),
  b_id INTEGER NOT NULL REFERENCES flags(id),
  a_votes INTEGER DEFAULT 0,
  b_votes INTEGER DEFAULT 0,
  n_total INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_flag_stats_games ON flag_stats(games);
CREATE INDEX IF NOT EXISTS idx_flags_active ON flags(is_active);
