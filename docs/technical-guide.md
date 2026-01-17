# Technical Guide: Adapting FlagRanks for Other Topics

This guide explains how FlagRanks works and how to adapt it for ranking any category of items (fonts, logos, album covers, etc.).

## Overview

FlagRanks is a head-to-head voting app where users compare two items and pick a winner. Votes are aggregated into a global leaderboard using Bayesian-smoothed scoring. The architecture cleanly separates the voting/ranking logic from the "flags" domain, making it straightforward to repurpose.

**Live site:** [flagranks.com](https://flagranks.com)

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, shadcn/ui, Tailwind CSS 4 |
| Database | PostgreSQL (AWS Aurora on Vercel, Docker locally) |
| Deployment | Vercel |
| Language | TypeScript |

---

## Project Structure

```
flagranks/
├── app/                      # Next.js App Router
│   ├── api/                  # API endpoints
│   │   ├── matchups/         # GET - fetch item pairings
│   │   ├── votes/            # POST - record user votes
│   │   ├── leaderboard/      # GET - fetch rankings
│   │   ├── flags/[id]/       # GET - individual item data
│   │   └── seed/             # POST - initialize database
│   ├── flags/[iso2]/         # Individual item detail pages
│   ├── leaderboard/          # Leaderboard page
│   ├── layout.tsx            # Root layout with metadata
│   └── page.tsx              # Home voting page
│
├── components/               # React components
│   ├── ui/                   # shadcn/ui primitives
│   ├── voting-screen.tsx     # Main voting interface
│   ├── flag-card.tsx         # Individual item display
│   └── header.tsx            # Navigation
│
├── hooks/                    # Custom React hooks
│   ├── use-vote-queue.ts     # Vote batching and retries
│   ├── use-matchup-queue.ts  # Matchup loading
│   └── use-voting-keyboard.ts # Keyboard controls
│
├── lib/                      # Utilities and data
│   ├── db/
│   │   ├── index.ts          # Database functions
│   │   ├── seed-data.ts      # Item definitions (193 flags)
│   │   └── cached-flags.ts   # Cached item pool for SSR
│   ├── types.ts              # TypeScript interfaces
│   ├── scoring.ts            # Bayesian smoothing
│   └── personal-stats.ts     # localStorage user stats
│
├── public/flags/             # SVG assets (193 files)
├── docker-compose.yml        # Local PostgreSQL
└── .env.example              # Environment template
```

---

## Database Schema

Three tables power the entire app:

### `flags` (Items Table)

```sql
CREATE TABLE flags (
  id SERIAL PRIMARY KEY,
  country_name VARCHAR(100) NOT NULL,
  iso2 CHAR(2) NOT NULL UNIQUE,
  svg_url VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**To adapt:** Rename columns to match your domain (e.g., `item_name`, `slug`).

### `flag_stats` (Aggregate Stats)

```sql
CREATE TABLE flag_stats (
  flag_id INTEGER PRIMARY KEY REFERENCES flags(id),
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  games INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_flag_stats_games ON flag_stats(games);
```

**To adapt:** No changes needed. This table is domain-agnostic.

### `votes_agg_pairings` (Pairwise Results)

```sql
CREATE TABLE votes_agg_pairings (
  pairing_id VARCHAR(20) PRIMARY KEY,  -- format: "minId-maxId"
  a_id INTEGER NOT NULL REFERENCES flags(id),
  b_id INTEGER NOT NULL REFERENCES flags(id),
  a_votes INTEGER DEFAULT 0,
  b_votes INTEGER DEFAULT 0,
  n_total INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**To adapt:** No changes needed. The `pairing_id` format ("5-12") works for any items.

---

## API Routes

### GET `/api/matchups`

Fetches a batch of random pairings for voting.

**Query params:**
- `count` (default: 10, max: 20) - number of matchups
- `exclude` (comma-separated IDs) - skip these items

**Response:**
```json
{
  "userFlagId": 123,
  "matchups": [
    {
      "a": { "id": 5, "svg_url": "/flags/us.svg", "country_name": "United States" },
      "b": { "id": 12, "svg_url": "/flags/jp.svg", "country_name": "Japan" },
      "matchupId": "5-12",
      "stats": { "aVotes": 1234, "bVotes": 987, "n": 2221 }
    }
  ]
}
```

**Strategy:** Prioritizes under-voted items by querying the bottom quartile by game count, then shuffling randomly.

### POST `/api/votes`

Records user votes in batches.

**Request:**
```json
{
  "votes": [
    { "winnerId": 5, "loserId": 12 },
    { "winnerId": 3, "loserId": 8 }
  ]
}
```

**Batch limit:** 50 votes per request.

**Implementation:** Uses a single SQL transaction with CTEs and `UNNEST` to update both `votes_agg_pairings` and `flag_stats` atomically.

### GET `/api/leaderboard`

Fetches ranked items.

**Query params:**
- `limit` (default: 200, max: 200)

**Response:**
```json
{
  "flags": [{ "id": 1, "country_name": "Japan", "wins": 5000, "losses": 2000, ... }],
  "total": 193
}
```

---

## Scoring Algorithm

Items are ranked using **Bayesian smoothing** to prevent low-sample items from dominating.

```typescript
// lib/scoring.ts
const SMOOTHING_K = 10;

function calculateSmoothedScore(wins: number, games: number): number {
  return (wins + SMOOTHING_K * 0.5) / (games + SMOOTHING_K);
}
```

**How it works:**
- Adds 10 "virtual votes" (5 wins, 5 losses) to every item
- Items with 0 votes start at 50%
- As real votes accumulate, the score approaches the true win rate
- Prevents a 1-0 item from outranking a 1000-400 item

**Example:**
| Item | Wins | Losses | Raw % | Smoothed % |
|------|------|--------|-------|------------|
| A | 1 | 0 | 100% | 54.5% |
| B | 20 | 5 | 80% | 71.4% |

Item B ranks higher despite lower raw percentage due to sample size.

---

## Client-Side Architecture

### Vote Queue (`hooks/use-vote-queue.ts`)

Handles vote submission with resilience:

1. **Batching:** Accumulates votes, flushes when reaching 5 or on page unload
2. **Retry:** Exponential backoff (1s → 2s → 4s), max 3 retries
3. **Persistence:** Failed votes saved to localStorage, recovered on next visit
4. **Beacon API:** Uses `navigator.sendBeacon` on unload for reliability

### Matchup Queue (`hooks/use-matchup-queue.ts`)

Manages the stream of matchups:

1. Maintains in-memory queue of pending matchups
2. Refills via API when queue drops below 5 items
3. Accepts SSR-generated initial matchups (no loading spinner on first load)

### Personal Stats (`lib/personal-stats.ts`)

Stores user's voting history in localStorage:

```json
{
  "5": { "wins": 12, "losses": 3 },
  "12": { "wins": 8, "losses": 7 }
}
```

Powers the personal leaderboard without any server-side user accounts.

---

## Adapting for a Different Topic

### Step 1: Update Seed Data

Edit `lib/db/seed-data.ts`:

```typescript
// Before (flags)
export const UN_MEMBER_FLAGS = [
  { iso2: "us", country_name: "United States" },
  { iso2: "jp", country_name: "Japan" },
  // ...193 entries
];

// After (fonts)
export const FONTS = [
  { slug: "helvetica", name: "Helvetica", designer: "Max Miedinger" },
  { slug: "futura", name: "Futura", designer: "Paul Renner" },
  // ...your items
];
```

### Step 2: Update Database Schema

Modify the flags table creation in `lib/db/index.ts`:

```sql
-- Before
CREATE TABLE flags (
  id SERIAL PRIMARY KEY,
  country_name VARCHAR(100) NOT NULL,
  iso2 CHAR(2) NOT NULL UNIQUE,
  svg_url VARCHAR(255) NOT NULL,
  ...
);

-- After
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  image_url VARCHAR(255) NOT NULL,
  metadata JSONB,  -- optional extra fields
  ...
);
```

### Step 3: Update TypeScript Types

Edit `lib/types.ts`:

```typescript
// Before
export interface MatchupFlag {
  id: number;
  svg_url: string;
  country_name: string;
}

// After
export interface MatchupItem {
  id: number;
  image_url: string;
  name: string;
  metadata?: Record<string, unknown>;
}
```

### Step 4: Update Routes

Rename the dynamic route:

```
app/flags/[iso2]/page.tsx  →  app/items/[slug]/page.tsx
```

Update `generateStaticParams()` to use your new data source.

### Step 5: Update Components

Edit `components/flag-card.tsx`:

```tsx
// Change prop names and display text
interface ItemCardProps {
  item: MatchupItem;
  onSelect: () => void;
}

export function ItemCard({ item, onSelect }: ItemCardProps) {
  return (
    <button onClick={onSelect}>
      <Image src={item.image_url} alt={item.name} />
      <span>{item.name}</span>
    </button>
  );
}
```

### Step 6: Update Assets

Replace files in `public/flags/` with your images, or change the path to `public/items/`.

### Step 7: Remove Geo-Exclusion (Optional)

The current app excludes the user's home country flag. This is flags-specific. In `lib/db/index.ts`, remove or modify the geo-exclusion logic in `getMatchups()`.

---

## Environment Setup

### Local Development

1. Copy `.env.example` to `.env.local`:
   ```
   PGHOST=localhost
   PGPORT=5432
   PGUSER=postgres
   PGPASSWORD=postgres
   PGDATABASE=flagranks
   ```

2. Start PostgreSQL:
   ```bash
   docker-compose up -d
   ```

3. Install dependencies and run:
   ```bash
   npm install
   npm run dev
   ```

4. Seed the database (once):
   ```bash
   curl -X POST http://localhost:3000/api/seed
   ```

### Production (Vercel)

Environment variables are set in the Vercel dashboard. The app uses AWS IAM authentication for Aurora PostgreSQL via Vercel's OIDC integration.

Required variables:
- `PGHOST` - Aurora cluster endpoint
- `PGUSER` - Database user
- `PGDATABASE` - Database name
- `AWS_REGION` - AWS region
- `AWS_ROLE_ARN` - IAM role ARN

---

## Performance Optimizations

1. **Server-Side Rendering (ISR)**
   - Home page regenerates every 60 seconds
   - Initial matchups generated server-side (no loading state)

2. **API Caching**
   - Matchups: 30s max-age, 300s stale-while-revalidate
   - Leaderboard: 60s max-age, 300s stale-while-revalidate

3. **Batch Operations**
   - Votes sent in batches of 5
   - Single SQL query for bulk updates

4. **Connection Pooling**
   - Database pool attached to Vercel Functions

---

## What Stays the Same

When adapting for a new topic, these components need no changes:

- Voting logic and UI flow
- Vote queue with retry/persistence
- Matchup queue with prefetching
- Bayesian scoring algorithm
- Leaderboard ranking logic
- Personal stats in localStorage
- Keyboard navigation
- All shadcn/ui components
- Caching strategy
- Error handling

---

## Checklist for Adaptation

- [ ] Define your items in `lib/db/seed-data.ts`
- [ ] Update database schema (table/column names)
- [ ] Update TypeScript types in `lib/types.ts`
- [ ] Rename route from `flags/[iso2]` to `items/[slug]`
- [ ] Update component props and display text
- [ ] Add your image assets to `public/`
- [ ] Update metadata in `app/layout.tsx` (site name, description)
- [ ] Update sitemap generation in `app/sitemap.ts`
- [ ] Remove geo-exclusion if not applicable
- [ ] Test locally with `docker-compose` and seed endpoint
- [ ] Deploy to Vercel and configure environment variables

---

## Questions?

The codebase is intentionally minimal. If something seems missing, it's probably not needed. The core insight is that head-to-head voting and Bayesian ranking are completely domain-agnostic—only the data and display layer need customization.
