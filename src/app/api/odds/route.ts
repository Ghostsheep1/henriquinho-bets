import { NextResponse } from "next/server";
import type { Match, SportKey } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const oddsApiKeyRaw = (process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY ?? "").trim();
const oddsApiKey = oddsApiKeyRaw && !oddsApiKeyRaw.includes("your-") ? oddsApiKeyRaw : undefined;
const realOddsOnly = process.env.REAL_ODDS_ONLY !== "false";
const oddsCacheTtlMs = 5 * 60 * 1000;
const oddsErrorCacheTtlMs = 60 * 60 * 1000;
const scoreboardCacheTtlMs = 60 * 1000;
const maxOddsSportsPerRefresh = Math.max(1, Number(process.env.ODDS_REFRESH_SPORT_LIMIT ?? 8));

type OddsPayload = {
  source: "odds-api" | "espn-public";
  oddsSource: "real-provider" | "calculated-demo";
  configured: boolean;
  realOddsOnly: boolean;
  matches: Match[];
  message: string;
  cached?: boolean;
  stale?: boolean;
  providerError?: string;
};

type CacheEntry<T> = { expiresAt: number; data: T };

let responseCache: CacheEntry<OddsPayload> | null = null;
let lastGoodRealOdds: OddsPayload | null = null;
let activeSportsCache: CacheEntry<Set<string>> | null = null;
let fallbackCache: CacheEntry<Match[]> | null = null;

const realOddsSports: Array<{ key: string; sport: SportKey; league: string; country: string }> = [
  { key: "soccer_fifa_world_cup", sport: "soccer", league: "FIFA World Cup", country: "World" },
  { key: "soccer_uefa_european_championship", sport: "soccer", league: "UEFA Euro", country: "Europe" },
  { key: "soccer_uefa_champs_league", sport: "soccer", league: "Champions League", country: "Europe" },
  { key: "soccer_uefa_europa_league", sport: "soccer", league: "Europa League", country: "Europe" },
  { key: "soccer_copa_libertadores", sport: "soccer", league: "Copa Libertadores", country: "South America" },
  { key: "soccer_brazil_campeonato", sport: "soccer", league: "Brazilian Serie A", country: "Brazil" },
  { key: "soccer_epl", sport: "soccer", league: "Premier League", country: "England" },
  { key: "soccer_spain_la_liga", sport: "soccer", league: "La Liga", country: "Spain" },
  { key: "soccer_italy_serie_a", sport: "soccer", league: "Serie A", country: "Italy" },
  { key: "soccer_germany_bundesliga", sport: "soccer", league: "Bundesliga", country: "Germany" },
  { key: "soccer_france_ligue_one", sport: "soccer", league: "Ligue 1", country: "France" },
  { key: "soccer_usa_mls", sport: "soccer", league: "MLS", country: "USA" },
  { key: "basketball_nba", sport: "nba", league: "NBA", country: "USA" },
  { key: "americanfootball_nfl", sport: "nfl", league: "NFL", country: "USA" },
  { key: "baseball_mlb", sport: "mlb", league: "MLB", country: "USA" },
  { key: "icehockey_nhl", sport: "nhl", league: "NHL", country: "USA/Canada" },
  { key: "mma_mixed_martial_arts", sport: "mma", league: "UFC/MMA", country: "Global" },
  { key: "tennis_atp", sport: "tennis", league: "Tennis", country: "Global" },
  { key: "tennis_wta", sport: "tennis", league: "Tennis", country: "Global" },
  { key: "boxing_boxing", sport: "boxing", league: "Boxing", country: "Global" },
];

const oddsRefreshPriority = [
  "baseball_mlb",
  "soccer_fifa_world_cup",
  "soccer_uefa_european_championship",
  "soccer_epl",
  "americanfootball_nfl",
  "basketball_nba",
  "soccer_uefa_champs_league",
  "soccer_copa_libertadores",
  "soccer_brazil_campeonato",
  "soccer_usa_mls",
  "icehockey_nhl",
  "mma_mixed_martial_arts",
  "tennis_atp",
  "tennis_wta",
  "boxing_boxing",
] as const;

const fallbackScoreboardEndpoints: Array<{ url: string; sport: SportKey; league: string; country: string; dateWindow?: boolean }> = [
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard", sport: "soccer", league: "FIFA World Cup", country: "World", dateWindow: true },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.euro/scoreboard", sport: "soccer", league: "UEFA Euro", country: "Europe", dateWindow: true },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.olympics/scoreboard", sport: "soccer", league: "Olympic Soccer", country: "World", dateWindow: true },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.wwc/scoreboard", sport: "soccer", league: "FIFA Women's World Cup", country: "World", dateWindow: true },
  { url: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard", sport: "nba", league: "NBA", country: "USA" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard", sport: "nfl", league: "NFL", country: "USA" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard", sport: "mlb", league: "MLB", country: "USA" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard", sport: "nhl", league: "NHL", country: "USA/Canada" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard", sport: "mma", league: "UFC", country: "Global" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard", sport: "soccer", league: "Premier League", country: "England" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard", sport: "soccer", league: "La Liga", country: "Spain" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard", sport: "soccer", league: "Serie A", country: "Italy" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard", sport: "soccer", league: "Bundesliga", country: "Germany" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/fra.1/scoreboard", sport: "soccer", league: "Ligue 1", country: "France" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard", sport: "soccer", league: "MLS", country: "USA" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard", sport: "soccer", league: "Champions League", country: "Europe" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/scoreboard", sport: "soccer", league: "Europa League", country: "Europe" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa.conf/scoreboard", sport: "soccer", league: "Conference League", country: "Europe" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/conmebol.libertadores/scoreboard", sport: "soccer", league: "Copa Libertadores", country: "South America" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard", sport: "soccer", league: "Brazilian Serie A", country: "Brazil" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.fa/scoreboard", sport: "soccer", league: "English FA Cup", country: "England" },
  { url: "https://site.api.espn.com/apis/site/v2/sports/soccer/usa.nwsl/scoreboard", sport: "soccer", league: "NWSL", country: "USA" },
];

const stalePastWindowMs = 48 * 60 * 60 * 1000;
const futureWindowDays = 4;

type OddsApiOutcome = { name: string; price: number; point?: number };
type OddsApiMarket = { key: "h2h" | "spreads" | "totals"; outcomes: OddsApiOutcome[] };
type OddsApiBookmaker = { key: string; title: string; last_update: string; markets: OddsApiMarket[] };
type OddsApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsApiBookmaker[];
};

type OddsApiErrorBody = { message?: string; error_code?: string };

type EspnCompetition = {
  competitors: Array<{
    homeAway: "home" | "away";
    score?: string;
    team: { displayName: string; shortDisplayName?: string };
    records?: Array<{ summary?: string }>;
  }>;
};

type EspnEvent = {
  id: string;
  date: string;
  name: string;
  competitions?: Array<{
    status?: { type?: { state?: string; completed?: boolean; shortDetail?: string }; displayClock?: string };
    competitors?: EspnCompetition["competitors"];
  }>;
};

function decimal(price?: number) {
  return typeof price === "number" && Number.isFinite(price) ? Number(price.toFixed(2)) : undefined;
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function providerError(response: Response, label: string) {
  const text = await response.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as OddsApiErrorBody;
    const code = parsed.error_code ? ` ${parsed.error_code}` : "";
    const message = parsed.message ? ` - ${parsed.message}` : "";
    return `${label} failed: ${response.status}${code}${message}`;
  } catch {
    return `${label} failed: ${response.status}${text ? ` - ${text.slice(0, 120)}` : ""}`;
  }
}

function chooseBookmaker(bookmakers: OddsApiBookmaker[] = []) {
  const preferred = ["draftkings", "fanduel", "betmgm", "pinnacle", "bet365"];
  return [...bookmakers].sort((a, b) => {
    const preferredGap = (preferred.indexOf(a.key) === -1 ? 99 : preferred.indexOf(a.key)) - (preferred.indexOf(b.key) === -1 ? 99 : preferred.indexOf(b.key));
    if (preferredGap !== 0) return preferredGap;
    if (b.markets.length !== a.markets.length) return b.markets.length - a.markets.length;
    return new Date(b.last_update).getTime() - new Date(a.last_update).getTime();
  })[0];
}

function oddsStatus(commenceTime: string): Match["status"] {
  const startsAt = new Date(commenceTime).getTime();
  if (!Number.isFinite(startsAt)) return "upcoming";
  const age = Date.now() - startsAt;
  if (age >= 0 && age <= 4 * 60 * 60 * 1000) return "live";
  if (age > 4 * 60 * 60 * 1000) return "finished";
  return "upcoming";
}

function normalizeOddsEvent(event: OddsApiEvent, config: (typeof realOddsSports)[number]): Match | null {
  const bookmaker = chooseBookmaker(event.bookmakers);
  const h2h = bookmaker?.markets.find((market) => market.key === "h2h");
  if (!bookmaker || !h2h) return null;
  const homeKey = normalizeName(event.home_team);
  const awayKey = normalizeName(event.away_team);
  const homeMoneyline = h2h.outcomes.find((outcome) => normalizeName(outcome.name) === homeKey);
  const awayMoneyline = h2h.outcomes.find((outcome) => normalizeName(outcome.name) === awayKey);
  const drawMoneyline = h2h.outcomes.find((outcome) => normalizeName(outcome.name) === "draw");
  const homePrice = decimal(homeMoneyline?.price);
  const awayPrice = decimal(awayMoneyline?.price);
  if (!homePrice || !awayPrice) return null;

  const totals = bookmaker.markets.find((market) => market.key === "totals");
  const over = totals?.outcomes.find((outcome) => outcome.name.toLowerCase() === "over");
  const under = totals?.outcomes.find((outcome) => outcome.name.toLowerCase() === "under");
  const spreads = bookmaker.markets.find((market) => market.key === "spreads");
  const homeSpread = spreads?.outcomes.find((outcome) => normalizeName(outcome.name) === homeKey);
  const awaySpread = spreads?.outcomes.find((outcome) => normalizeName(outcome.name) === awayKey);

  const status = oddsStatus(event.commence_time);
  if (status === "finished") return null;

  return {
    id: `odds-api-${config.key}-${event.id}`,
    sport: config.sport,
    league: config.league,
    country: config.country,
    home: event.home_team,
    away: event.away_team,
    startsAt: event.commence_time,
    status,
    odds: {
      moneyline: {
        home: homePrice,
        ...(drawMoneyline ? { draw: decimal(drawMoneyline.price) } : {}),
        away: awayPrice,
      },
      ...(over?.point !== undefined && under?.point !== undefined && decimal(over.price) && decimal(under.price)
        ? { total: { line: over.point, over: decimal(over.price)!, under: decimal(under.price)! } }
        : {}),
      ...(homeSpread?.point !== undefined && awaySpread?.point !== undefined && decimal(homeSpread.price) && decimal(awaySpread.price)
        ? { handicap: { line: homeSpread.point, home: decimal(homeSpread.price)!, away: decimal(awaySpread.price)! } }
        : {}),
    },
    oddsSource: "real-provider",
    oddsProvider: bookmaker.title,
    oddsUpdatedAt: bookmaker.last_update,
    source: "odds-api",
  };
}

function recordStrength(summary?: string, fallback = 0.5) {
  const [wins, losses] = summary?.split("-").map(Number) ?? [];
  if (!Number.isFinite(wins) || !Number.isFinite(losses) || wins + losses === 0) return fallback;
  return Math.max(0.18, Math.min(0.82, wins / (wins + losses)));
}

function calculatedOdds(homeStrength: number, awayStrength: number, drawAllowed: boolean) {
  const drawProb = drawAllowed ? 0.25 : 0;
  const remaining = 1 - drawProb;
  const total = homeStrength + awayStrength;
  const homeProb = remaining * (homeStrength / total);
  const awayProb = remaining * (awayStrength / total);
  const toOdds = (probability: number) => Number(Math.max(1.15, (0.94 / probability)).toFixed(2));
  return {
    moneyline: {
      home: toOdds(homeProb),
      ...(drawAllowed ? { draw: toOdds(drawProb) } : {}),
      away: toOdds(awayProb),
    },
    total: { line: drawAllowed ? 2.5 : 8.5, over: 1.91, under: 1.91 },
    handicap: { line: Number((homeProb > awayProb ? -0.5 : 0.5).toFixed(1)), home: 1.91, away: 1.91 },
  };
}

function dateKeys() {
  return Array.from({ length: futureWindowDays + 1 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + index);
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  });
}

function normalizeFallbackEvent(event: EspnEvent, config: (typeof fallbackScoreboardEndpoints)[number]): Match | null {
  const competition = event.competitions?.[0];
  const competitors = competition?.competitors ?? [];
  const home = competitors.find((item) => item.homeAway === "home");
  const away = competitors.find((item) => item.homeAway === "away");
  if (!home || !away) return null;
  const state = competition?.status?.type?.state;
  const status: Match["status"] = competition?.status?.type?.completed ? "finished" : state === "in" ? "live" : "upcoming";
  const startsAt = new Date(event.date).getTime();
  if (Number.isFinite(startsAt) && startsAt < Date.now() - stalePastWindowMs && status !== "live") return null;
  const hasScore = home.score !== undefined && away.score !== undefined && (status === "live" || status === "finished");
  return {
    id: `espn-${config.sport}-${event.id}`,
    sport: config.sport,
    league: config.league,
    country: config.country,
    home: home.team.displayName,
    away: away.team.displayName,
    startsAt: event.date,
    status,
    minute: competition?.status?.type?.shortDetail ?? competition?.status?.displayClock,
    score: hasScore ? `${home.score} - ${away.score}` : undefined,
    odds: calculatedOdds(recordStrength(home.records?.[0]?.summary, 0.52), recordStrength(away.records?.[0]?.summary, 0.48), config.sport === "soccer"),
    oddsSource: "calculated-demo",
    oddsProvider: "Henriquinho demo pricing",
    oddsUpdatedAt: new Date().toISOString(),
    source: "espn-public",
  };
}

async function getRealOdds() {
  if (!oddsApiKey) return null;
  let activeKeys = activeSportsCache?.expiresAt && activeSportsCache.expiresAt > Date.now() ? activeSportsCache.data : null;
  if (!activeKeys) {
    const activeSportsResponse = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${oddsApiKey}`, { cache: "no-store" });
    if (!activeSportsResponse.ok) {
      throw new Error(`The Odds API sports request failed: ${activeSportsResponse.status}`);
    }
    const activeSports = (await activeSportsResponse.json()) as Array<{ key: string; active: boolean }>;
    activeKeys = new Set(activeSports.filter((sport) => sport.active).map((sport) => sport.key));
    activeSportsCache = { expiresAt: Date.now() + 10 * 60 * 1000, data: activeKeys };
  }
  const configs = realOddsSports
    .filter((config) => activeKeys.has(config.key))
    .sort((a, b) => {
      const aRank = oddsRefreshPriority.indexOf(a.key as (typeof oddsRefreshPriority)[number]);
      const bRank = oddsRefreshPriority.indexOf(b.key as (typeof oddsRefreshPriority)[number]);
      return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank);
    })
    .slice(0, maxOddsSportsPerRefresh);
  const results = await Promise.all(
    configs.map(async (config) => {
      try {
        const url = new URL(`https://api.the-odds-api.com/v4/sports/${config.key}/odds`);
        url.searchParams.set("apiKey", oddsApiKey);
        url.searchParams.set("regions", "us,uk,eu");
        url.searchParams.set("markets", "h2h,spreads,totals");
        url.searchParams.set("oddsFormat", "decimal");
        url.searchParams.set("dateFormat", "iso");
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return { matches: [] as Match[], error: await providerError(response, `${config.key} odds request`) };
        const payload = (await response.json()) as OddsApiEvent[];
        return { matches: payload.map((event) => normalizeOddsEvent(event, config)).filter(Boolean) as Match[] };
      } catch (error) {
        return { matches: [] as Match[], error: error instanceof Error ? `${config.key}: ${error.message}` : `${config.key}: unknown provider error` };
      }
    }),
  );
  const matches = results.flatMap((result) => result.matches).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const errors = results.map((result) => result.error).filter(Boolean) as string[];
  if (!matches.length && errors.length) throw new Error(errors.slice(0, 3).join("; "));
  return { matches, errors };
}

async function getFallbackOdds() {
  if (fallbackCache && fallbackCache.expiresAt > Date.now()) return fallbackCache.data;
  const results = await Promise.all(
    fallbackScoreboardEndpoints.map(async (config) => {
      const urls = config.dateWindow ? dateKeys().map((date) => `${config.url}?dates=${date}`) : [config.url];
      const payloads = await Promise.all(
        urls.map(async (url) => {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) return [];
          const payload = (await response.json()) as { events?: EspnEvent[] };
          return payload.events ?? [];
        }),
      );
      const byId = new Map<string, EspnEvent>();
      payloads.flat().forEach((event) => byId.set(event.id, event));
      return Array.from(byId.values()).map((event) => normalizeFallbackEvent(event, config)).filter(Boolean) as Match[];
    }),
  );
  const fallback = results.flat();
  fallbackCache = { expiresAt: Date.now() + scoreboardCacheTtlMs, data: fallback };
  return fallback;
}

function stripCalculatedOdds(matches: Match[]) {
  if (!realOddsOnly) return matches;
  return matches.map((match) => ({
    ...match,
    odds: undefined,
    oddsSource: undefined,
    oddsProvider: undefined,
    oddsUpdatedAt: undefined,
  }));
}

export async function GET() {
  if (responseCache && responseCache.expiresAt > Date.now()) {
    return NextResponse.json({ ...responseCache.data, cached: true }, { headers: { "Cache-Control": "private, max-age=10" } });
  }

  try {
    const realOdds = await getRealOdds();
    if (realOdds?.matches.length) {
      const payload: OddsPayload = {
        source: "odds-api",
        oddsSource: "real-provider",
        configured: true,
        realOddsOnly,
        matches: realOdds.matches,
        message: realOdds.errors.length ? "Realtime bookmaker odds loaded for active supported markets." : "Realtime bookmaker odds loaded",
        providerError: realOdds.errors[0],
      };
      responseCache = { expiresAt: Date.now() + oddsCacheTtlMs, data: payload };
      lastGoodRealOdds = payload;
      return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=10" } });
    }

    const fallback = await getFallbackOdds();
    const payload: OddsPayload = {
      source: "espn-public",
      oddsSource: realOddsOnly ? "real-provider" : "calculated-demo",
      configured: Boolean(oddsApiKey),
      realOddsOnly,
      matches: stripCalculatedOdds(fallback),
      message: oddsApiKey
        ? "The Odds API returned no active bookmaker odds for these events yet."
        : "Missing THE_ODDS_API_KEY or ODDS_API_KEY. Add a real key for realtime bookmaker odds.",
    };
    responseCache = { expiresAt: Date.now() + scoreboardCacheTtlMs, data: payload };
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=10" } });
  } catch (error) {
    if (lastGoodRealOdds) {
      const payload: OddsPayload = {
        ...lastGoodRealOdds,
        stale: true,
        message: "Showing last good bookmaker odds while provider refreshes.",
        providerError: error instanceof Error ? error.message : "Unknown odds provider error",
      };
      responseCache = { expiresAt: Date.now() + oddsCacheTtlMs, data: payload };
      return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=10" } });
    }
    const fallback = await getFallbackOdds().catch(() => []);
    const payload: OddsPayload = {
      source: "odds-api",
      oddsSource: realOddsOnly ? "real-provider" : "calculated-demo",
      configured: Boolean(oddsApiKey),
      realOddsOnly,
      matches: stripCalculatedOdds(fallback),
      message: oddsApiKey && error instanceof Error && error.message.includes("OUT_OF_USAGE_CREDITS")
        ? "The Odds API quota is used up. Add a fresh key or wait for the quota reset to show real bookmaker odds."
        : oddsApiKey ? "Realtime odds provider error. Check API quota/key and try again." : "Missing real odds API key.",
      providerError: error instanceof Error ? error.message : "Unknown odds provider error",
    };
    responseCache = { expiresAt: Date.now() + (payload.providerError?.includes("OUT_OF_USAGE_CREDITS") ? oddsErrorCacheTtlMs : scoreboardCacheTtlMs), data: payload };
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=10" } });
  }
}
