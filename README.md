# FlagRanks

A web game where users vote on which national flag is better designed. Compare flags head-to-head, see community results, and explore the leaderboard.

**Live site:** [flagranks.com](https://flagranks.com)

## Features

- **Zero friction voting** - No sign-up required, just tap and vote
- **193 UN member flags** - Compare flags from around the world
- **Community results** - See how your taste compares to others
- **Bayesian-smoothed rankings** - Leaderboard accounts for sample size
- **Country exclusion** - Your own country's flag is excluded (via IP geolocation)
- **Keyboard support** - Use arrow keys for rapid voting on desktop
- **Mobile-first design** - Optimized for touch with bottom sheet results

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** AWS Aurora PostgreSQL (via Vercel integration)
- **Styling:** Tailwind CSS 4
- **Components:** shadcn/ui
- **Deployment:** Vercel

## Local Development

The AWS database uses IAM authentication that only works on Vercel. For local development, use Docker:

```bash
# Start local PostgreSQL
docker-compose up -d

# Install dependencies
npm install

# Run development server
npm run dev
```

The app will detect the local database and connect automatically.

## Environment Variables

For production (set in Vercel):

```
PGHOST=<aurora-cluster-endpoint>
PGUSER=<database-user>
PGDATABASE=<database-name>
PGPORT=5432
AWS_REGION=<aws-region>
AWS_ROLE_ARN=<iam-role-arn>
```

For local development with Docker, create `.env.local`:

```
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=flagranks
PGPORT=5432
```

## Database Schema

- **flags** - Country name, ISO2 code, SVG URL
- **flag_stats** - Wins, losses, total games per flag
- **votes_agg_pairings** - Aggregated votes for each flag pairing

## API Routes

- `GET /api/matchup` - Get a random flag pairing
- `POST /api/vote` - Record a vote
- `GET /api/leaderboard` - Get ranked flags
- `POST /api/seed` - Seed the database (one-time setup)
