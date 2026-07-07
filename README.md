# HenriquinhoBets

HenriquinhoBets is a sportsbook and casino interface built with Next.js 14 App Router, Tailwind CSS, Supabase-ready auth/data tables, no-key public sports feeds, and a full playable casino lobby.

## What is built

- Supabase-ready registration/login profile flow with automatic 1,000 starting balance in SQL.
- Sportsbook that renders live/upcoming events returned by public scoreboards.
- Featured FIFA World Cup, Euro, Olympic, and Women's World Cup sections from public soccer data.
- Real bookmaker odds when provider quota is available, with a free Henriquinho open model fallback when bookmaker feeds are missing or exhausted.
- Model-generated moneyline, totals, handicap, multi-pick parlays, and settlement hook. Model lines are virtual prices, not bookmaker lines.
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
HENRIQUINHO_INTERNAL_SPORTS_ONLY=false
API_FOOTBALL_REAL_SNAPSHOT=true
API_FOOTBALL_REFRESH_MS=864000
API_FOOTBALL_KEY=your-api-football-key
DEFAULT_MARKET_MAX_STAKE=250
LICENSED_INJURY_FEED_URL=
LICENSED_INJURY_FEED_KEY=
LICENSED_NEWS_FEED_URL=
LICENSED_NEWS_FEED_KEY=
LICENSED_SHARP_FEED_URL=
LICENSED_SHARP_FEED_KEY=
LICENSED_HISTORY_FEED_URL=
LICENSED_HISTORY_FEED_KEY=
LICENSED_STATS_FEED_URL=
LICENSED_STATS_FEED_KEY=
TRADER_CONTROLS_JSON=
```

Free-tier sources:

- Supabase: [https://supabase.com](https://supabase.com)
- The Odds API: [https://the-odds-api.com](https://the-odds-api.com)
- API-Football: [https://www.api-football.com](https://www.api-football.com)
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

- `GET /api/odds`: uses API-Football real fixture snapshots when `API_FOOTBALL_REAL_SNAPSHOT=true`, refreshing upstream at most once every `API_FOOTBALL_REFRESH_MS` milliseconds. `864000` ms is 14 minutes 24 seconds, or 100 refresh windows per day. The app calculates Henriquinho odds from that cached real fixture snapshot. If snapshot mode is off, it can use The Odds API for realtime bookmaker odds when `THE_ODDS_API_KEY` or `ODDS_API_KEY` has quota, or the model fallback when configured. Live possession, shots, corners, dangerous attacks, and provider xG are shown only when real `API_FOOTBALL_KEY` or `LICENSED_STATS_FEED_*` data is available.
- `GET /api/football`: fetches featured soccer tournament scoreboards for the featured tournament panel.
- `GET /api/henriquinho-sports`: local unlimited Henriquinho sports API. When `HENRIQUINHO_INTERNAL_SPORTS_ONLY=true`, `/api/odds` and `/api/football` use this internal engine and make no external sports API calls. These are generated demo markets, not real-world live sports data.
- `POST /api/settle`: placeholder settlement endpoint for a cron worker that compares open bets against final provider results.

The open model is unlimited for the beta because it uses public scoreboards and local calculations. Licensed injury/news/sharp/history/stats feeds are optional: configure the corresponding `LICENSED_*_FEED_URL` and `LICENSED_*_FEED_KEY` variables when you have a vendor. Each feed may return an array or `{ records: [...] }` with fields like `eventId`, `home`, `away`, `team`, `side`, `impact`, `probabilityShift`, `confidence`, `closingLineScore`, `sampleSize`, `possessionHome`, `possessionAway`, `xgHome`, `xgAway`, `shotsHome`, `shotsAway`, `shotsOnTargetHome`, `shotsOnTargetAway`, `dangerousAttacksHome`, `dangerousAttacksAway`, `cornersHome`, `cornersAway`, `momentumHome`, `momentumAway`, `heatmapHome`, and `heatmapAway`.

`TRADER_CONTROLS_JSON` supports manual market controls without code changes:

```json
{
  "defaultMaxStake": 250,
  "defaultMarginBoost": 0.01,
  "events": [
    {
      "home": "Brazil",
      "away": "Norway",
      "homeAdjustment": 0.04,
      "marginBoost": 0.02,
      "maxStake": 100,
      "suspended": false,
      "note": "Manual risk review"
    }
  ]
}
```

Real sportsbook-level accuracy still requires licensed historical, injury, lineup, news, and market-movement feeds. The code is ready to consume them, but the data itself must come from a licensed vendor.

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
