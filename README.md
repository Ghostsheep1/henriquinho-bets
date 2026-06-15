# HenriquinhoBets

HenriquinhoBets is a sportsbook and casino interface built with Next.js 14 App Router, Tailwind CSS, Supabase-ready auth/data tables, no-key public sports feeds, and a full playable casino lobby.

## What is built

- Supabase-ready registration/login profile flow with automatic 1,000 starting balance in SQL.
- Sportsbook that only renders live/upcoming events returned by public scoreboards.
- Featured FIFA World Cup, Euro, Olympic, and Women's World Cup sections from public soccer data.
- Real API empty states: if scoreboards are temporarily unavailable, the UI shows “Odds updating soon” instead of invented matches.
- Calculated demo moneyline, totals, handicap, multi-pick parlays, and settlement hook. These are virtual prices, not real sportsbook lines.
- Casino section with flagship playable games plus a 100+ game categorized lobby.
- Deposit modal with amount presets, payment method badges, 2-second processing state, confirmation, and wallet ledger entry.
- Wallet history, daily bonus, leaderboard, profile stats, bet history, live ticker, mobile sidebar, footer links, and admin metrics shell.

## Local setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Replace the placeholders in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-for-server-jobs-only
THE_ODDS_API_KEY=your-the-odds-api-key
ODDS_API_KEY=your-the-odds-api-key
REAL_ODDS_ONLY=true
API_FOOTBALL_KEY=your-api-football-key
```

Free-tier sources:

- Supabase: [https://supabase.com](https://supabase.com)
- The Odds API: [https://the-odds-api.com](https://the-odds-api.com)
- Public scoreboards are used for local sports data and do not require an API key.

## Supabase database

1. Create a free Supabase project.
2. In Auth settings, disable email confirmation for local testing.
3. Add `http://localhost:3000` to allowed redirect URLs.
4. Open the SQL editor.
5. Run `supabase/schema.sql`.
6. Run `supabase/seed.sql` only if you want initial database rows for manual API sync testing.
7. Copy your project URL and anon key into `.env.local`.

The schema creates `profiles`, `transactions`, `matches`, `bets`, and `game_rounds` with Row Level Security policies for user-owned records.

## API routes

- `GET /api/odds`: uses The Odds API for realtime bookmaker odds when `THE_ODDS_API_KEY` or `ODDS_API_KEY` is set. With `REAL_ODDS_ONLY=true`, scoreboard events still show but calculated demo prices are not bettable.
- `GET /api/football`: fetches featured soccer tournament scoreboards for the featured tournament panel.
- `POST /api/settle`: placeholder settlement endpoint for a cron worker that compares open bets against final provider results.

The sports UI polls often, but true odds freshness is limited by the provider and your free-tier quota.

## Vercel deployment

1. Push the repo to GitHub.
2. Create a new Vercel project from the repo.
3. Set the project root to `henriquinho-bets`.
4. Add the Supabase and odds variables from `.env.local` in Vercel Project Settings -> Environment Variables.
5. Deploy.
6. In Supabase Auth URL settings, add your Vercel URL to Site URL and Redirect URLs.
7. Redeploy after any environment variable change.

## Verification

```bash
npm run lint
npm run build
```
