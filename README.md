# HenriquinhoBets

HenriquinhoBets is a sportsbook and casino interface built with Next.js 14 App Router, Tailwind CSS, Supabase-ready auth/data tables, no-key public sports feeds, and a full playable casino lobby.

## What is built

- Supabase-ready registration/login profile flow with automatic 1,000 starting balance in SQL.
- Sportsbook that renders live/upcoming events returned by public scoreboards.
- Featured FIFA World Cup, Euro, Olympic, and Women's World Cup sections from public soccer data.
- Genuine bookmaker odds only when the configured provider returns them. Henriquinho model prices are stored and displayed as separate virtual/model markets; they are never labelled bookmaker or live odds.
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
ODDS_PROVIDER=the-odds-api
ODDS_PROVIDER_REGIONS=us
ODDS_PROVIDER_MARKETS=h2h,spreads,totals
ODDS_REFRESH_SPORT_LIMIT=1
ODDS_PREGAME_REFRESH_MS=300000
ODDS_LIVE_REFRESH_MS=60000
ODDS_PREGAME_STALE_MS=900000
ODDS_LIVE_STALE_MS=90000
ODDS_PROVIDER_TIMEOUT_MS=8000
ODDS_PROVIDER_MAX_RETRIES=2
ODDS_PROVIDER_MIN_REMAINING_CREDITS=20
ODDS_FALLBACK_MODE=model
REAL_ODDS_ONLY=false
ODDS_HEALTH_ADMIN_TOKEN=long-random-server-only-token
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

- `GET /api/odds`: tries the configured bookmaker provider first. A bookmaker market contains `provider`, `providerEventId`, `providerLastUpdated`, `fetchedAt`, `marketSource: "bookmaker"`, `marketStatus`, and decimal selections. The app refuses malformed prices and maps only events with a provider event ID. API-Football or public scoreboards may supply fixture data for the **model fallback**, but never bookmaker prices.
- `GET /api/odds/health`: protected operational endpoint. Send `x-odds-health-token` equal to `ODDS_HEALTH_ADMIN_TOKEN`. It reports provider state, quota headers where available, last success/error, cache age, and bookmaker/model/stale market counts. It never returns keys or raw provider payloads.
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

### Bookmaker provider configuration and quota

The production provider adapter is The Odds API v4. Set an active `THE_ODDS_API_KEY` in Vercel and use `ODDS_FALLBACK_MODE=disable` for a bookmaker-only release. `model` is appropriate only when clearly offering virtual Henriquinho model markets.

- The provider's free plan currently has 500 credits per month. The odds endpoint is charged by `regions x unique markets`; the default `us` region and `h2h,spreads,totals` means **3 credits per sport refresh**. Verify current terms before launch at [The Odds API pricing](https://the-odds-api.com/) and [v4 guide](https://the-odds-api.com/liveapi/guides/v4/).
- Default quota-safe configuration polls one sport every 5 minutes pregame and every minute when a returned market is live. At the pregame cadence, one sport uses about 8,640 credits per 30-day month if traffic keeps the route warm; this exceeds the free allowance. Raise `ODDS_REFRESH_SPORT_LIMIT` only after choosing a plan that covers the resulting volume. The provider exposes quota headers, and the app stops requesting for one hour once the configured safety threshold is reached.
- The app caches one response per runtime, retries only 429/5xx responses with capped exponential backoff, honors `Retry-After` when sent, and never continuously retries a quota-exhausted response. Visible client refreshes are aligned to `:00` each minute.
- Pregame markets suspend after 15 minutes without a provider timestamp; live markets suspend after 90 seconds. Finished, postponed, missing, malformed, and provider-failed markets cannot be bet. A selection is rechecked against its exact current price immediately before placement; the saved bet retains the source and recorded price for settlement.

Real sportsbook-level accuracy still requires licensed historical, injury, lineup, news, and market-movement feeds. The code is ready to consume them, but the data itself must come from a licensed vendor.

## Vercel deployment

1. Push the repo to GitHub.
2. Create a new Vercel project from the repo.
3. Set the project root to `henriquinho-bets`.
4. Add the Supabase and odds variables from `.env.local` in Vercel Project Settings -> Environment Variables. Keep all keys server-only: do not prefix odds keys or `ODDS_HEALTH_ADMIN_TOKEN` with `NEXT_PUBLIC_`.
5. Deploy.
6. In Supabase Auth URL settings, add your Vercel URL to Site URL and Redirect URLs.
7. Redeploy after any environment variable change.

## Verification

```bash
npm run lint
npm test
npm run build
```
