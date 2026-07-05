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
const modelVersion = "HENQ-OPEN-ODDS-3.0";
const defaultMaxMarketStake = Number(process.env.DEFAULT_MARKET_MAX_STAKE ?? 250);

type OddsPayload = {
  source: "odds-api" | "espn-public" | "henriquinho-model";
  oddsSource: "real-provider" | "model-provider" | "calculated-demo";
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
let licensedSignalsCache: CacheEntry<{ records: Record<LicensedFeedKind, LicensedFeedRecord[]>; status: FeedStatus; traderControls: TraderControls }> | null = null;

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

type TeamModelInput = {
  name: string;
  record?: string;
  score?: number;
  homeAway: "home" | "away";
};

type ModelContext = {
  sport: SportKey;
  league: string;
  startsAt: string;
  status: Match["status"];
  minute?: string;
  home: TeamModelInput;
  away: TeamModelInput;
  external: ExternalSignals;
};

type ModelPricing = {
  odds: NonNullable<Match["odds"]>;
  meta: NonNullable<Match["model"]>;
  risk: NonNullable<Match["risk"]>;
  trader: NonNullable<Match["trader"]>;
};

type LicensedFeedKind = "injury" | "news" | "sharp" | "history";
type FeedStatus = Record<LicensedFeedKind, "active" | "missing" | "error">;
type LicensedFeedRecord = {
  eventId?: string;
  home?: string;
  away?: string;
  team?: string;
  side?: "home" | "away";
  impact?: number;
  probabilityShift?: number;
  confidence?: number;
  closingLineScore?: number;
  sampleSize?: number;
  headline?: string;
  note?: string;
};
type TraderControl = {
  home?: string;
  away?: string;
  eventId?: string;
  adjustment?: number;
  homeAdjustment?: number;
  awayAdjustment?: number;
  marginBoost?: number;
  maxStake?: number;
  suspended?: boolean;
  note?: string;
};
type TraderControls = {
  defaultMaxStake?: number;
  defaultMarginBoost?: number;
  events?: TraderControl[];
};
type ExternalSignals = {
  homeAdjustment: number;
  awayAdjustment: number;
  marginBoost: number;
  confidenceBoost: number;
  dataQualityBoost: number;
  maxStake?: number;
  suspended: boolean;
  note?: string;
  feedStatus: FeedStatus;
  feedSignals: string[];
  closingLineScore: number;
  calibrationSampleSize: number;
  traderControlled: boolean;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hashUnit(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function emptyFeedStatus(): FeedStatus {
  return { injury: "missing", news: "missing", sharp: "missing", history: "missing" };
}

function emptyExternalSignals(feedStatus: FeedStatus = emptyFeedStatus()): ExternalSignals {
  return {
    homeAdjustment: 0,
    awayAdjustment: 0,
    marginBoost: 0,
    confidenceBoost: 0,
    dataQualityBoost: 0,
    suspended: false,
    feedStatus,
    feedSignals: [],
    closingLineScore: 0.5,
    calibrationSampleSize: 0,
    traderControlled: false,
  };
}

function readTraderControls(): TraderControls {
  if (!process.env.TRADER_CONTROLS_JSON) return {};
  try {
    return JSON.parse(process.env.TRADER_CONTROLS_JSON) as TraderControls;
  } catch {
    return {};
  }
}

function feedConfig(kind: LicensedFeedKind) {
  const prefix = `LICENSED_${kind.toUpperCase()}_FEED`;
  return {
    url: process.env[`${prefix}_URL`],
    key: process.env[`${prefix}_KEY`],
  };
}

function coerceFeedRecords(payload: unknown): LicensedFeedRecord[] {
  if (Array.isArray(payload)) return payload as LicensedFeedRecord[];
  if (payload && typeof payload === "object") {
    const data = payload as { records?: unknown; events?: unknown; items?: unknown; data?: unknown };
    const records = data.records ?? data.events ?? data.items ?? data.data;
    if (Array.isArray(records)) return records as LicensedFeedRecord[];
  }
  return [];
}

async function fetchLicensedFeed(kind: LicensedFeedKind) {
  const config = feedConfig(kind);
  if (!config.url) return { status: "missing" as const, records: [] as LicensedFeedRecord[] };
  try {
    const response = await fetch(config.url, {
      cache: "no-store",
      headers: config.key ? { Authorization: `Bearer ${config.key}`, "x-api-key": config.key } : undefined,
    });
    if (!response.ok) return { status: "error" as const, records: [] as LicensedFeedRecord[] };
    return { status: "active" as const, records: coerceFeedRecords(await response.json()) };
  } catch {
    return { status: "error" as const, records: [] as LicensedFeedRecord[] };
  }
}

async function getLicensedSignals() {
  if (licensedSignalsCache && licensedSignalsCache.expiresAt > Date.now()) return licensedSignalsCache.data;
  const kinds: LicensedFeedKind[] = ["injury", "news", "sharp", "history"];
  const results = await Promise.all(kinds.map(async (kind) => [kind, await fetchLicensedFeed(kind)] as const));
  const status = emptyFeedStatus();
  const records: Record<LicensedFeedKind, LicensedFeedRecord[]> = { injury: [], news: [], sharp: [], history: [] };
  for (const [kind, result] of results) {
    status[kind] = result.status;
    records[kind] = result.records;
  }
  const data = { records, status, traderControls: readTraderControls() };
  licensedSignalsCache = { expiresAt: Date.now() + scoreboardCacheTtlMs, data };
  return data;
}

function recordMatches(record: LicensedFeedRecord | TraderControl, eventId: string, home: string, away: string) {
  if (record.eventId && record.eventId === eventId) return true;
  const homeKey = normalizeName(home);
  const awayKey = normalizeName(away);
  return (!record.home || normalizeName(record.home) === homeKey) && (!record.away || normalizeName(record.away) === awayKey);
}

function sideAdjustment(record: LicensedFeedRecord, home: string, away: string) {
  const impact = clamp(record.impact ?? record.probabilityShift ?? 0, -0.25, 0.25);
  if (record.side === "home" || (record.team && normalizeName(record.team) === normalizeName(home))) return { home: impact, away: -impact * 0.5 };
  if (record.side === "away" || (record.team && normalizeName(record.team) === normalizeName(away))) return { home: -impact * 0.5, away: impact };
  return { home: impact * 0.5, away: -impact * 0.5 };
}

function externalSignalsForEvent(eventId: string, home: string, away: string, licensed: Awaited<ReturnType<typeof getLicensedSignals>>): ExternalSignals {
  const external = emptyExternalSignals(licensed.status);
  const feedNames: Array<[LicensedFeedKind, string]> = [
    ["injury", "licensed-injury-feed"],
    ["news", "licensed-news-feed"],
    ["sharp", "sharp-market-feed"],
    ["history", "closing-line-history"],
  ];

  for (const [kind, signal] of feedNames) {
    for (const record of licensed.records[kind].filter((item) => recordMatches(item, eventId, home, away))) {
      const adjustment = sideAdjustment(record, home, away);
      external.homeAdjustment += adjustment.home;
      external.awayAdjustment += adjustment.away;
      external.confidenceBoost += clamp(record.confidence ?? 0.02, 0, 0.08);
      external.dataQualityBoost += 0.04;
      if (record.closingLineScore !== undefined) external.closingLineScore = clamp(record.closingLineScore, 0, 1);
      if (record.sampleSize !== undefined) external.calibrationSampleSize = Math.max(external.calibrationSampleSize, record.sampleSize);
      if (!external.feedSignals.includes(signal)) external.feedSignals.push(signal);
    }
  }

  const controls = licensed.traderControls;
  external.maxStake = controls.defaultMaxStake;
  external.marginBoost += controls.defaultMarginBoost ?? 0;
  const control = controls.events?.find((item) => recordMatches(item, eventId, home, away));
  if (control) {
    external.homeAdjustment += control.homeAdjustment ?? control.adjustment ?? 0;
    external.awayAdjustment += control.awayAdjustment ?? -(control.adjustment ?? 0) * 0.5;
    external.marginBoost += control.marginBoost ?? 0;
    external.maxStake = control.maxStake ?? external.maxStake;
    external.suspended = Boolean(control.suspended);
    external.note = control.note;
    external.traderControlled = true;
    external.feedSignals.push("trader-control");
  }

  external.homeAdjustment = clamp(external.homeAdjustment, -0.35, 0.35);
  external.awayAdjustment = clamp(external.awayAdjustment, -0.35, 0.35);
  external.marginBoost = clamp(external.marginBoost, 0, 0.08);
  external.confidenceBoost = clamp(external.confidenceBoost, 0, 0.16);
  external.dataQualityBoost = clamp(external.dataQualityBoost, 0, 0.2);
  return external;
}

function normalizeProbabilities(probabilities: number[]) {
  const total = probabilities.reduce((sum, probability) => sum + probability, 0);
  if (total <= 0) return probabilities.map(() => 1 / probabilities.length);
  return probabilities.map((probability) => probability / total);
}

function marketCycle(startsAt: string) {
  const starts = new Date(startsAt).getTime();
  const base = Number.isFinite(starts) ? starts : Date.now();
  return Math.floor((Date.now() + base) / (5 * 60 * 1000));
}

function movementSignal(context: ModelContext) {
  const cycle = marketCycle(context.startsAt);
  return (hashUnit(`${cycle}:${context.league}:${context.home.name}:${context.away.name}:steam`) - 0.5) * 0.055;
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
  const [wins, losses, draws] = summary?.split("-").map(Number) ?? [];
  if (!Number.isFinite(wins) || !Number.isFinite(losses) || wins + losses + (draws || 0) === 0) return fallback;
  return clamp((wins + 0.5 * (draws || 0)) / (wins + losses + (draws || 0)), 0.18, 0.82);
}

const leagueStrength: Record<string, number> = {
  "FIFA World Cup": 1,
  "UEFA Euro": 0.96,
  "Champions League": 0.94,
  "Premier League": 0.91,
  NBA: 0.9,
  NFL: 0.9,
  MLB: 0.86,
  NHL: 0.84,
  "Copa Libertadores": 0.82,
  "Brazilian Serie A": 0.78,
  MLS: 0.68,
  NWSL: 0.64,
};

const sportProfiles: Record<SportKey, { draw: number; total: number; spreadStep: number; homeAdv: number; volatility: number }> = {
  soccer: { draw: 0.25, total: 2.5, spreadStep: 0.5, homeAdv: 0.1, volatility: 0.82 },
  nba: { draw: 0, total: 222.5, spreadStep: 5.5, homeAdv: 0.12, volatility: 1.14 },
  nfl: { draw: 0, total: 44.5, spreadStep: 3.5, homeAdv: 0.14, volatility: 0.96 },
  mlb: { draw: 0, total: 8.5, spreadStep: 1.5, homeAdv: 0.06, volatility: 1.04 },
  nhl: { draw: 0, total: 6.0, spreadStep: 1.5, homeAdv: 0.09, volatility: 0.94 },
  mma: { draw: 0, total: 2.5, spreadStep: 0.5, homeAdv: 0, volatility: 1.18 },
  tennis: { draw: 0, total: 22.5, spreadStep: 2.5, homeAdv: 0, volatility: 1.08 },
  formula1: { draw: 0, total: 0.5, spreadStep: 0.5, homeAdv: 0, volatility: 1.24 },
  boxing: { draw: 0.03, total: 8.5, spreadStep: 0.5, homeAdv: 0, volatility: 1.16 },
};

function teamPower(team: TeamModelInput, context: ModelContext) {
  const record = recordStrength(team.record, team.homeAway === "home" ? 0.52 : 0.48);
  const seededQuality = 0.28 + hashUnit(`${context.sport}:${context.league}:${team.name}:rating`) * 0.54;
  const publicSignal = (hashUnit(`${new Date().toISOString().slice(0, 10)}:${team.name}:public-signal`) - 0.5) * 0.1;
  const leagueBoost = (leagueStrength[context.league] ?? 0.55) * 0.08;
  const homeBoost = team.homeAway === "home" ? sportProfiles[context.sport].homeAdv : 0;
  return clamp(record * 0.46 + seededQuality * 0.34 + leagueBoost + homeBoost + publicSignal, 0.12, 1.04);
}

function liveAdjustment(context: ModelContext) {
  const homeScore = context.home.score ?? 0;
  const awayScore = context.away.score ?? 0;
  const minuteText = context.minute ?? "";
  const minute = Number(minuteText.match(/\d+/)?.[0] ?? 0);
  if (context.status !== "live" || !Number.isFinite(minute) || minute <= 0) return { home: 0, away: 0, pace: 0 };
  const scoreGap = homeScore - awayScore;
  const elapsed = context.sport === "soccer" ? clamp(minute / 90, 0.05, 0.98) : clamp(minute / 60, 0.05, 0.98);
  const leverage = 0.32 + elapsed * 1.25;
  return {
    home: scoreGap * leverage,
    away: -scoreGap * leverage,
    pace: (homeScore + awayScore) * (0.12 + elapsed * 0.08),
  };
}

function timeAdjustment(startsAt: string) {
  const hours = (new Date(startsAt).getTime() - Date.now()) / (60 * 60 * 1000);
  if (!Number.isFinite(hours)) return 0;
  if (hours <= 1) return 0.03;
  if (hours <= 24) return 0.015;
  if (hours >= 24 * 7) return -0.02;
  return 0;
}

function modelConfidence(context: ModelContext, closeness: number) {
  const hasHomeRecord = Boolean(context.home.record);
  const hasAwayRecord = Boolean(context.away.record);
  const startsAt = new Date(context.startsAt).getTime();
  const hoursUntilStart = Number.isFinite(startsAt) ? Math.abs(startsAt - Date.now()) / (60 * 60 * 1000) : 999;
  const recordScore = (hasHomeRecord ? 0.18 : 0) + (hasAwayRecord ? 0.18 : 0);
  const leagueScore = (leagueStrength[context.league] ?? 0.55) * 0.18;
  const timingScore = hoursUntilStart <= 48 || context.status === "live" ? 0.18 : hoursUntilStart <= 168 ? 0.1 : 0.05;
  const liveScore = context.status === "live" ? 0.12 : 0.06;
  const separationScore = (1 - closeness) * 0.16;
  return clamp(0.28 + recordScore + leagueScore + timingScore + liveScore + separationScore + context.external.confidenceBoost, 0.34, 0.96);
}

function modelOdds(context: ModelContext): ModelPricing {
  const profile = sportProfiles[context.sport];
  const live = liveAdjustment(context);
  const movement = movementSignal(context);
  const homePower = teamPower(context.home, context) + live.home + timeAdjustment(context.startsAt) + movement + context.external.homeAdjustment;
  const awayPower = teamPower(context.away, context) + live.away + context.external.awayAdjustment;
  const powerGap = (homePower - awayPower) / Math.max(0.18, profile.volatility);
  const rawHome = sigmoid(powerGap * 2.45);
  const rawAway = 1 - rawHome;
  const closeness = 1 - Math.abs(rawHome - rawAway);
  const drawProb = context.sport === "soccer" || context.sport === "boxing" ? clamp(profile.draw * (0.72 + closeness * 0.56), 0.06, 0.34) : 0;
  const [homeProb, drawNormalized, awayProb] = drawProb
    ? normalizeProbabilities([clamp(rawHome * (1 - drawProb), 0.04, 0.92), drawProb, clamp(rawAway * (1 - drawProb), 0.04, 0.92)])
    : [clamp(rawHome, 0.04, 0.92), 0, clamp(rawAway, 0.04, 0.92)];
  const confidence = modelConfidence(context, closeness);
  const dataQuality = clamp(confidence + (context.home.record && context.away.record ? 0.04 : -0.06) + context.external.dataQualityBoost, 0.28, 0.98);
  const calibrationDiscount = context.external.calibrationSampleSize > 50 ? (context.external.closingLineScore - 0.5) * 0.025 : 0;
  const margin = round(clamp(0.045 + (1 - confidence) * 0.045 + (context.status === "live" ? 0.012 : 0) + context.external.marginBoost - calibrationDiscount, 0.035, 0.14), 3);
  const toOdds = (probability: number) => round(clamp(1 / (probability * (1 + margin)), 1.08, 18));
  const expectedTotal = profile.total + live.pace + (homePower + awayPower - 1) * profile.volatility * (context.sport === "soccer" ? 1.2 : 8);
  const totalLineBase = context.sport === "soccer" || context.sport === "mlb" || context.sport === "nhl" || context.sport === "boxing"
    ? clamp(expectedTotal, profile.total * 0.55, profile.total * 1.65)
    : clamp(expectedTotal, profile.total * 0.75, profile.total * 1.25);
  const totalLine = Math.round(totalLineBase * 2) / 2;
  const overProb = clamp(0.5 + (expectedTotal - profile.total) / (profile.total * 7), 0.38, 0.62);
  const handicapLine = round((homeProb >= awayProb ? -1 : 1) * clamp(Math.abs(homeProb - awayProb) * profile.spreadStep * 2.6, profile.spreadStep, profile.spreadStep * 4), 1);
  return {
    odds: {
      moneyline: {
        home: toOdds(homeProb),
        ...(drawNormalized ? { draw: toOdds(drawNormalized) } : {}),
        away: toOdds(awayProb),
      },
      total: { line: totalLine, over: toOdds(overProb), under: toOdds(1 - overProb) },
      handicap: { line: handicapLine, home: round(1.86 + clamp(awayProb - homeProb, -0.22, 0.26)), away: round(1.86 + clamp(homeProb - awayProb, -0.22, 0.26)) },
    },
    meta: {
      version: modelVersion,
      confidence: round(confidence),
      dataQuality: round(dataQuality),
      margin,
      signals: [
        "public-scoreboard",
        "team-record",
        "sport-scoring-profile",
        "league-strength",
        "home-advantage",
        "time-to-start",
        "five-minute-line-movement",
        context.status === "live" ? "live-score-state" : "pre-match-state",
        ...context.external.feedSignals,
      ],
      feedStatus: context.external.feedStatus,
      calibration: { closingLineScore: round(context.external.closingLineScore), sampleSize: context.external.calibrationSampleSize },
    },
    risk: {
      maxStake: Math.max(1, Math.round((context.external.maxStake ?? defaultMaxMarketStake) * clamp(confidence, 0.35, 0.95) * (context.status === "live" ? 0.72 : 1))),
      exposureTier: confidence < 0.52 || context.status === "live" ? "high" : confidence < 0.72 ? "medium" : "low",
      reviewRequired: context.external.suspended || confidence < 0.42 || context.external.traderControlled,
      reasons: [
        ...(context.status === "live" ? ["live-market"] : []),
        ...(confidence < 0.52 ? ["low-confidence"] : []),
        ...(context.external.traderControlled ? ["trader-control"] : []),
        ...(context.external.suspended ? ["market-suspended"] : []),
      ],
    },
    trader: { controlled: context.external.traderControlled, suspended: context.external.suspended, note: context.external.note },
  };
}

function dateKeys() {
  return Array.from({ length: futureWindowDays + 1 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + index);
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  });
}

function normalizeFallbackEvent(event: EspnEvent, config: (typeof fallbackScoreboardEndpoints)[number], licensed: Awaited<ReturnType<typeof getLicensedSignals>>): Match | null {
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
  const pricing = modelOdds({
    sport: config.sport,
    league: config.league,
    startsAt: event.date,
    status,
    minute: competition?.status?.type?.shortDetail ?? competition?.status?.displayClock,
    home: { name: home.team.displayName, record: home.records?.[0]?.summary, score: Number(home.score ?? 0), homeAway: "home" },
    away: { name: away.team.displayName, record: away.records?.[0]?.summary, score: Number(away.score ?? 0), homeAway: "away" },
    external: externalSignalsForEvent(event.id, home.team.displayName, away.team.displayName, licensed),
  });
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
    odds: pricing.odds,
    oddsSource: "model-provider",
    oddsProvider: `${modelVersion} open model`,
    oddsUpdatedAt: new Date().toISOString(),
    model: pricing.meta,
    risk: pricing.risk,
    trader: pricing.trader,
    source: "henriquinho-model",
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
  const licensed = await getLicensedSignals();
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
      return Array.from(byId.values()).map((event) => normalizeFallbackEvent(event, config, licensed)).filter(Boolean) as Match[];
    }),
  );
  const fallback = results.flat();
  fallbackCache = { expiresAt: Date.now() + scoreboardCacheTtlMs, data: fallback };
  return fallback;
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
      source: "henriquinho-model",
      oddsSource: "model-provider",
      configured: Boolean(oddsApiKey),
      realOddsOnly,
      matches: fallback,
      message: oddsApiKey
        ? "Henriquinho model odds loaded while bookmaker odds are unavailable."
        : "Henriquinho model odds loaded. Add THE_ODDS_API_KEY for bookmaker odds.",
      providerError: oddsApiKey ? "The Odds API returned no active bookmaker odds for these events yet." : undefined,
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
      source: "henriquinho-model",
      oddsSource: "model-provider",
      configured: Boolean(oddsApiKey),
      realOddsOnly,
      matches: fallback,
      message: oddsApiKey && error instanceof Error && error.message.includes("OUT_OF_USAGE_CREDITS")
        ? "Henriquinho model odds loaded. Bookmaker odds quota is used up."
        : oddsApiKey ? "Henriquinho model odds loaded while bookmaker odds refresh." : "Henriquinho model odds loaded. Add a real key for bookmaker odds.",
      providerError: error instanceof Error ? error.message : "Unknown odds provider error",
    };
    responseCache = { expiresAt: Date.now() + (payload.providerError?.includes("OUT_OF_USAGE_CREDITS") ? oddsErrorCacheTtlMs : scoreboardCacheTtlMs), data: payload };
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=10" } });
  }
}
