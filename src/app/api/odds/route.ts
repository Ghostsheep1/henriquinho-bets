import { NextResponse } from "next/server";
import type { Match, SportKey } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const oddsApiKeyRaw = process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY;
const oddsApiKey = oddsApiKeyRaw && !oddsApiKeyRaw.includes("your-") ? oddsApiKeyRaw : undefined;

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
  const activeSportsResponse = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${oddsApiKey}`, { cache: "no-store" });
  if (!activeSportsResponse.ok) return null;
  const activeSports = (await activeSportsResponse.json()) as Array<{ key: string; active: boolean }>;
  const activeKeys = new Set(activeSports.filter((sport) => sport.active).map((sport) => sport.key));
  const configs = realOddsSports.filter((config) => activeKeys.has(config.key));
  const results = await Promise.all(
    configs.map(async (config) => {
      const url = new URL(`https://api.the-odds-api.com/v4/sports/${config.key}/odds`);
      url.searchParams.set("apiKey", oddsApiKey);
      url.searchParams.set("regions", "us,uk,eu");
      url.searchParams.set("markets", "h2h,spreads,totals");
      url.searchParams.set("oddsFormat", "decimal");
      url.searchParams.set("dateFormat", "iso");
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) return [];
      const payload = (await response.json()) as OddsApiEvent[];
      return payload.map((event) => normalizeOddsEvent(event, config)).filter(Boolean) as Match[];
    }),
  );
  return results.flat().sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

async function getFallbackOdds() {
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
  return results.flat();
}

export async function GET() {
  try {
    const realOdds = await getRealOdds();
    if (realOdds?.length) {
      return NextResponse.json({ source: "odds-api", oddsSource: "real-provider", configured: true, matches: realOdds, message: "ok" });
    }

    const fallback = await getFallbackOdds();
    return NextResponse.json({
      source: "espn-public",
      oddsSource: "calculated-demo",
      configured: Boolean(oddsApiKey),
      matches: fallback,
      message: oddsApiKey ? "Real odds temporarily unavailable" : "Add THE_ODDS_API_KEY for real sportsbook odds",
    });
  } catch {
    return NextResponse.json({ source: "odds-api", oddsSource: oddsApiKey ? "real-provider" : "calculated-demo", configured: Boolean(oddsApiKey), matches: [], message: "Odds updating soon" });
  }
}
