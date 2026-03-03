#!/usr/bin/env node
/**
 * One-time import script: loads Aurora export JSON into Neon.
 *
 * Usage:
 *   TARGET_DATABASE_URL="postgres://...@neon.tech/flagranks?sslmode=require" node scripts/import-to-neon.mjs
 */

import { readFileSync } from "fs";
import pg from "pg";
const { Pool } = pg;

const DATA_PATH = new URL("../data/aurora-export.json", import.meta.url);

// ── connect ──────────────────────────────────────────────
const url = process.env.TARGET_DATABASE_URL;
if (!url) {
  console.error("Set TARGET_DATABASE_URL to continue.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

// ── read export ──────────────────────────────────────────
const data = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
console.log("Export from:", data.exported_at);
console.log("Source counts:", data.counts);

// ── create tables ────────────────────────────────────────
async function createTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS flags (
      id SERIAL PRIMARY KEY,
      country_name VARCHAR(100) NOT NULL,
      iso2 CHAR(2) NOT NULL UNIQUE,
      svg_url VARCHAR(255) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS flag_stats (
      flag_id INTEGER PRIMARY KEY REFERENCES flags(id),
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      games INTEGER DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await client.query(`
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

  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_flag_stats_games ON flag_stats(games)`
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_flags_active ON flags(is_active)`
  );

  console.log("Tables created.");
}

// ── insert rows ──────────────────────────────────────────
async function insertFlags(client, rows) {
  for (const r of rows) {
    await client.query(
      `INSERT INTO flags (id, country_name, iso2, svg_url, is_active, created_at)
       OVERRIDING SYSTEM VALUE
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [r.id, r.country_name, r.iso2, r.svg_url, r.is_active, r.created_at]
    );
  }
  console.log(`  flags: ${rows.length} rows inserted`);
}

async function insertFlagStats(client, rows) {
  for (const r of rows) {
    await client.query(
      `INSERT INTO flag_stats (flag_id, wins, losses, games, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (flag_id) DO NOTHING`,
      [r.flag_id, r.wins, r.losses, r.games, r.updated_at]
    );
  }
  console.log(`  flag_stats: ${rows.length} rows inserted`);
}

async function insertPairings(client, rows) {
  for (const r of rows) {
    await client.query(
      `INSERT INTO votes_agg_pairings (pairing_id, a_id, b_id, a_votes, b_votes, n_total, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (pairing_id) DO NOTHING`,
      [
        r.pairing_id,
        r.a_id,
        r.b_id,
        r.a_votes,
        r.b_votes,
        r.n_total,
        r.updated_at,
      ]
    );
  }
  console.log(`  votes_agg_pairings: ${rows.length} rows inserted`);
}

// ── main ─────────────────────────────────────────────────
async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await createTables(client);

    console.log("Inserting rows...");
    await insertFlags(client, data.flags);
    await insertFlagStats(client, data.flag_stats);
    await insertPairings(client, data.votes_agg_pairings);

    // Reset the flags sequence so new inserts get the right ID
    const maxId = Math.max(...data.flags.map((f) => f.id));
    await client.query(`SELECT setval('flags_id_seq', $1)`, [maxId]);
    console.log(`  flags_id_seq reset to ${maxId}`);

    await client.query("COMMIT");
    console.log("\nImport complete.");

    // Verify counts
    const counts = {};
    for (const table of ["flags", "flag_stats", "votes_agg_pairings"]) {
      const res = await client.query(`SELECT count(*)::int as n FROM ${table}`);
      counts[table] = res.rows[0].n;
    }
    console.log("Neon row counts:", counts);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Import failed, rolled back:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
