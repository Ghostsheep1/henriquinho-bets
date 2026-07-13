import { NextResponse } from "next/server";
import type { Match, SportKey } from "@/lib/types";
import { getHenriquinhoInternalSports } from "@/lib/henriquinhoSports";
import { dedupeProviderEvents, isDecimalPrice, isMarketBettable, isPregameSnapshotRequest, providerEventKey, snapshotRefreshBlockReason } from "@/lib/odds/marketSafety";
import { requestProviderJson } from "@/lib/odds/providerClient";
import { recordOddsHealth, updateOddsHealth } from "@/lib/odds/healthStore";
import { readPersistedOddsSnapshot, writePersistedOddsSnapshot } from "@/lib/odds/snapshotPersistence";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const oddsApiKeyRaw = (process.env.THE_ODDS_API_KEY ?? process.env.ODDS_API_KEY ?? "").trim();
const oddsApiKey = oddsApiKeyRaw && !oddsApiKeyRaw.includes("your-") ? oddsApiKeyRaw : undefined;
const apiFootballKeyRaw = (process.env.API_FOOTBALL_KEY ?? "").trim();
const apiFootballKey = apiFootballKeyRaw && !apiFootballKeyRaw.includes("your-") ? apiFootballKeyRaw : undefined;
const apiFootballRealSnapshot = process.env.API_FOOTBALL_REAL_SNAPSHOT === "true";
const internalSportsOnly = process.env.HENRIQUINHO_INTERNAL_SPORTS_ONLY === "true";
const oddsOperationMode = process.env.ODDS_OPERATION_MODE === "pregame-snapshot" ? "pregame-snapshot" : "continuous";
const fallbackMode = process.env.ODDS_FALLBACK_MODE === "disable" || process.env.REAL_ODDS_ONLY === "true" ? "disable" : "model";
const realOddsOnly = fallbackMode === "disable";
const oddsProvider = process.env.ODDS_PROVIDER ?? "the-odds-api";
const oddsRegions = process.env.ODDS_PROVIDER_REGIONS ?? "us";
const oddsMarkets = process.env.ODDS_PROVIDER_MARKETS ?? "h2h,spreads,totals";
const oddsPregameRefreshMs = Math.max(60_000, Number(process.env.ODDS_PREGAME_REFRESH_MS ?? 15 * 60_000));
const oddsLiveRefreshMs = Math.max(15_000, Number(process.env.ODDS_LIVE_REFRESH_MS ?? 60_000));
const oddsPregameStaleMs = Math.max(60_000, Number(process.env.ODDS_PREGAME_STALE_MS ?? 15 * 60_000));
const oddsLiveStaleMs = Math.max(15_000, Number(process.env.ODDS_LIVE_STALE_MS ?? 90_000));
const oddsProviderTimeoutMs = Math.max(1_000, Number(process.env.ODDS_PROVIDER_TIMEOUT_MS ?? 8_000));
const oddsProviderMaxRetries = Math.max(0, Math.min(3, Number(process.env.ODDS_PROVIDER_MAX_RETRIES ?? 2)));
const oddsProviderMinCredits = Math.max(0, Number(process.env.ODDS_PROVIDER_MIN_REMAINING_CREDITS ?? 20));
const oddsMonthlyCreditReserve = Math.max(0, Number(process.env.ODDS_MONTHLY_CREDIT_RESERVE ?? 100));
const oddsDailyRequestLimit = Math.max(1, Number(process.env.ODDS_DAILY_REQUEST_LIMIT ?? 12));
const oddsPregameCutoffMs = Math.max(0, Number(process.env.ODDS_PREGAME_CUTOFF_MINUTES ?? 10)) * 60_000;
const oddsBookmakerMaxAgeMs = Math.max(1, Number(process.env.ODDS_BOOKMAKER_MAX_AGE_MINUTES ?? 135)) * 60_000;
const oddsErrorCacheTtlMs = 60 * 60 * 1000;
const scoreboardCacheTtlMs = 60 * 1000;
const apiFootballSnapshotCacheTtlMs = Math.max(60 * 1000, Number(process.env.API_FOOTBALL_REFRESH_MS ?? 864000));
const maxOddsSportsPerRefresh = Math.max(1, Number(process.env.ODDS_REFRESH_SPORT_LIMIT ?? 1));
const modelVersion = "HENQ-OPEN-ODDS-3.1";
const defaultMaxMarketStake = Number(process.env.DEFAULT_MARKET_MAX_STAKE ?? 250);

type OddsPayload = {
  integrationVersion?: "bookmaker-hardening-2026-07-13";
  source: "odds-api" | "espn-public" | "api-football" | "henriquinho-model" | "henriquinho-internal";
  oddsSource: "real-provider" | "model-provider" | "calculated-demo" | "unavailable";
  configured: boolean;
  realOddsOnly: boolean;
  matches: Match[];
  message: string;
  cached?: boolean;
  stale?: boolean;
  providerError?: string;
  fallbackMode?: "disable" | "model";
  fetchedAt?: string;
};

type CacheEntry<T> = { expiresAt: number; data: T };

let responseCache: CacheEntry<OddsPayload> | null = null;
let responseCachedAt = 0;
let lastGoodRealOdds: OddsPayload | null = null;
let activeSportsCache: CacheEntry<Set<string>> | null = null;
let fallbackCache: CacheEntry<Match[]> | null = null;
let licensedSignalsCache: CacheEntry<{ records: Record<LicensedFeedKind, LicensedFeedRecord[]>; status: FeedStatus; traderControls: TraderControls }> | null = null;
let apiFootballFixtureCache: CacheEntry<ApiFootballFixture[]> | null = null;
let apiFootballStatsCache: CacheEntry<Map<number, NonNullable<Match["liveStats"]>>> | null = null;
let apiFootballSnapshotCache: CacheEntry<Match[]> | null = null;
let oddsProviderBlockedUntil = 0;
let oddsProviderBlockedReason: string | null = null;
let pregameSnapshot: CacheEntry<Match[]> | null = null;
let pregameSnapshotRefreshInFlight = false;
let pregameSnapshotDailyKey = "";
let pregameSnapshotDailyRequests = 0;

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
  liveStats?: NonNullable<Match["liveStats"]>;
  meta: NonNullable<Match["model"]>;
  risk: NonNullable<Match["risk"]>;
  trader: NonNullable<Match["trader"]>;
};

type LicensedFeedKind = "injury" | "news" | "sharp" | "history" | "stats";
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
  possessionHome?: number;
  possessionAway?: number;
  xgHome?: number;
  xgAway?: number;
  shotsHome?: number;
  shotsAway?: number;
  shotsOnTargetHome?: number;
  shotsOnTargetAway?: number;
  dangerousAttacksHome?: number;
  dangerousAttacksAway?: number;
  cornersHome?: number;
  cornersAway?: number;
  momentumHome?: number;
  momentumAway?: number;
  heatmapHome?: number[];
  heatmapAway?: number[];
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
  stats?: NonNullable<Match["liveStats"]>;
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

type ApiFootballFixture = {
  fixture?: { id?: number; date?: string; status?: { long?: string; short?: string; elapsed?: number | null } };
  league?: { id?: number; name?: string; country?: string };
  teams?: { home?: { name?: string }; away?: { name?: string } };
  goals?: { home?: number | null; away?: number | null };
  statistics?: ApiFootballTeamStatistics[];
};

type ApiFootballTeamStatistics = {
  team?: { name?: string };
  statistics?: Array<{ type?: string; value?: string | number | null }>;
};

function decimal(price?: number) {
  return isDecimalPrice(price) ? Number(price.toFixed(2)) : undefined;
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

function nextMinuteBoundary() {
  return (Math.floor(Date.now() / 60_000) + 1) * 60_000;
}

function nextRefreshBoundary(intervalMs: number) {
  return (Math.floor(Date.now() / intervalMs) + 1) * intervalMs;
}

function emptyFeedStatus(): FeedStatus {
  return { injury: "missing", news: "missing", sharp: "missing", history: "missing", stats: "missing" };
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
  const kinds: LicensedFeedKind[] = ["injury", "news", "sharp", "history", "stats"];
  const results = await Promise.all(kinds.map(async (kind) => [kind, await fetchLicensedFeed(kind)] as const));
  const status = emptyFeedStatus();
  const records: Record<LicensedFeedKind, LicensedFeedRecord[]> = { injury: [], news: [], sharp: [], history: [], stats: [] };
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
    ["stats", "licensed-live-stats"],
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
      if (kind === "stats" && record.possessionHome !== undefined && record.possessionAway !== undefined) {
        external.stats = {
          source: "licensed-feed",
          possession: { home: clamp(record.possessionHome, 0, 100), away: clamp(record.possessionAway, 0, 100) },
          xg: { home: round(record.xgHome ?? 0), away: round(record.xgAway ?? 0) },
          shots: { home: Math.max(0, Math.round(record.shotsHome ?? 0)), away: Math.max(0, Math.round(record.shotsAway ?? 0)) },
          shotsOnTarget: { home: Math.max(0, Math.round(record.shotsOnTargetHome ?? 0)), away: Math.max(0, Math.round(record.shotsOnTargetAway ?? 0)) },
          dangerousAttacks: { home: Math.max(0, Math.round(record.dangerousAttacksHome ?? 0)), away: Math.max(0, Math.round(record.dangerousAttacksAway ?? 0)) },
          corners: { home: Math.max(0, Math.round(record.cornersHome ?? 0)), away: Math.max(0, Math.round(record.cornersAway ?? 0)) },
          momentum: { home: clamp(record.momentumHome ?? 50, 0, 100), away: clamp(record.momentumAway ?? 50, 0, 100) },
          heatmap: {
            home: normalizeHeatmap(record.heatmapHome),
            away: normalizeHeatmap(record.heatmapAway),
          },
        };
      }
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

function normalizeHeatmap(values?: number[]) {
  const cells = Array.from({ length: 15 }, (_, index) => clamp(values?.[index] ?? 0, 0, 100));
  const max = Math.max(1, ...cells);
  return cells.map((value) => Math.round((value / max) * 100));
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
  const fetchedAt = new Date().toISOString();
  const providerUpdatedAt = new Date(bookmaker.last_update);
  if (!Number.isFinite(providerUpdatedAt.getTime())) return null;
  const providerLastUpdated = providerUpdatedAt.toISOString();
  if (oddsOperationMode === "pregame-snapshot") {
    const startsAt = new Date(event.commence_time).getTime();
    if (status !== "upcoming" || !Number.isFinite(startsAt) || startsAt - Date.now() <= oddsPregameCutoffMs) return null;
  }

  return {
    id: `bookmaker-${providerEventKey(oddsProvider, event.id)}`,
    sport: config.sport,
    league: config.league,
    country: config.country,
    home: event.home_team,
    away: event.away_team,
    startsAt: event.commence_time,
    status,
    marketSource: "bookmaker",
    ...(oddsOperationMode === "pregame-snapshot" ? { marketMode: "pregame-snapshot" as const } : {}),
    marketStatus: status === "live" || status === "upcoming" ? "open" : "closed",
    provider: oddsProvider,
    providerEventId: event.id,
    providerLastUpdated,
    bookmakerLastUpdated: providerLastUpdated,
    fetchedAt,
    ...(oddsOperationMode === "pregame-snapshot" ? {
      marketCutoffAt: new Date(new Date(event.commence_time).getTime() - oddsPregameCutoffMs).toISOString(),
      marketExpiresAt: new Date(new Date(fetchedAt).getTime() + oddsBookmakerMaxAgeMs).toISOString(),
    } : {}),
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
    oddsUpdatedAt: providerLastUpdated,
    source: "odds-api",
  };
}

function stripEstimatedMarkets(match: Match): Match {
  return {
    id: match.id.replace(/^espn-/, "scoreboard-"),
    sport: match.sport,
    league: match.league,
    country: match.country,
    home: match.home,
    away: match.away,
    startsAt: match.startsAt,
    status: match.status,
    minute: match.minute,
    score: match.score,
    liveStats: match.liveStats,
    marketSource: match.marketSource,
    marketStatus: "suspended",
    suspensionReason: "Bookmaker odds unavailable and model fallback is disabled",
    provider: match.provider,
    providerEventId: match.providerEventId,
    providerLastUpdated: match.providerLastUpdated,
    fetchedAt: match.fetchedAt,
    source: "espn-public",
  };
}

function recordParts(summary?: string) {
  const [wins, losses, draws] = summary?.split("-").map(Number) ?? [];
  const games = (Number.isFinite(wins) ? wins : 0) + (Number.isFinite(losses) ? losses : 0) + (Number.isFinite(draws) ? draws : 0);
  return { wins: Number.isFinite(wins) ? wins : 0, draws: Number.isFinite(draws) ? draws : 0, games };
}

function recordStrength(summary?: string, fallback = 0.5) {
  const { wins, draws, games } = recordParts(summary);
  if (!games) return fallback;
  // Eight prior games prevent a short early-season record from overpricing a team.
  const priorGames = 8;
  return clamp((wins + 0.5 * draws + fallback * priorGames) / (games + priorGames), 0.18, 0.82);
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
  const homeBoost = team.homeAway === "home" ? sportProfiles[context.sport].homeAdv : 0;
  return clamp(record + homeBoost, 0.12, 1.04);
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
  const recordCoverage = clamp((recordParts(context.home.record).games + recordParts(context.away.record).games) / 30, 0, 1);
  const startsAt = new Date(context.startsAt).getTime();
  const hoursUntilStart = Number.isFinite(startsAt) ? Math.abs(startsAt - Date.now()) / (60 * 60 * 1000) : 999;
  const recordScore = recordCoverage * 0.36;
  const leagueScore = (leagueStrength[context.league] ?? 0.55) * 0.18;
  const timingScore = hoursUntilStart <= 48 || context.status === "live" ? 0.18 : hoursUntilStart <= 168 ? 0.1 : 0.05;
  const liveScore = context.status === "live" ? 0.12 : 0.06;
  const separationScore = (1 - closeness) * 0.16;
  return clamp(0.28 + recordScore + leagueScore + timingScore + liveScore + separationScore + context.external.confidenceBoost, 0.34, 0.96);
}

function poissonProbability(goals: number, expectedGoals: number) {
  let factorial = 1;
  for (let value = 2; value <= goals; value += 1) factorial *= value;
  return (Math.exp(-expectedGoals) * expectedGoals ** goals) / factorial;
}

function soccerDistribution(homeExpected: number, awayExpected: number) {
  let home = 0;
  let draw = 0;
  let away = 0;
  let overTwoPointFive = 0;
  for (let homeGoals = 0; homeGoals <= 8; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= 8; awayGoals += 1) {
      const probability = poissonProbability(homeGoals, homeExpected) * poissonProbability(awayGoals, awayExpected);
      if (homeGoals > awayGoals) home += probability;
      else if (homeGoals === awayGoals) draw += probability;
      else away += probability;
      if (homeGoals + awayGoals >= 3) overTwoPointFive += probability;
    }
  }
  const [homeProbability, drawProbability, awayProbability] = normalizeProbabilities([home, draw, away]);
  return { homeProbability, drawProbability, awayProbability, overTwoPointFive: clamp(overTwoPointFive, 0.05, 0.95) };
}

function modelOdds(context: ModelContext): ModelPricing {
  const profile = sportProfiles[context.sport];
  const live = liveAdjustment(context);
  const homePower = teamPower(context.home, context) + live.home + timeAdjustment(context.startsAt) + context.external.homeAdjustment;
  const awayPower = teamPower(context.away, context) + live.away + context.external.awayAdjustment;
  const powerGap = (homePower - awayPower) / Math.max(0.18, profile.volatility);
  const rawHome = sigmoid(powerGap * 2.45);
  const rawAway = 1 - rawHome;
  const closeness = 1 - Math.abs(rawHome - rawAway);
  const liveStats = context.external.stats;
  const statsPressure = liveStats
    ? context.sport === "soccer" && liveStats.xg
      ? (liveStats.xg.home + liveStats.xg.away - 2.4) * 0.35
      : (liveStats.shotsOnTarget.home + liveStats.shotsOnTarget.away) * 0.03
    : 0;
  const expectedTotal = profile.total + live.pace + statsPressure + (homePower + awayPower - 1) * profile.volatility * (context.sport === "soccer" ? 1.2 : 8);
  const soccer = context.sport === "soccer"
    ? soccerDistribution(
      clamp(expectedTotal * (0.5 + (rawHome - 0.5) * 0.72), 0.2, 4.5),
      clamp(expectedTotal * (0.5 + (rawAway - 0.5) * 0.72), 0.2, 4.5),
    )
    : null;
  const drawProb = context.sport === "boxing" ? clamp(profile.draw * (0.72 + closeness * 0.56), 0.03, 0.16) : 0;
  const [homeProb, drawNormalized, awayProb] = soccer
    ? [soccer.homeProbability, soccer.drawProbability, soccer.awayProbability]
    : drawProb
    ? normalizeProbabilities([clamp(rawHome * (1 - drawProb), 0.04, 0.92), drawProb, clamp(rawAway * (1 - drawProb), 0.04, 0.92)])
    : [clamp(rawHome, 0.04, 0.92), 0, clamp(rawAway, 0.04, 0.92)];
  const confidence = modelConfidence(context, closeness);
  const dataQuality = clamp(confidence + (context.home.record && context.away.record ? 0.04 : -0.06) + context.external.dataQualityBoost, 0.28, 0.98);
  const calibrationDiscount = context.external.calibrationSampleSize > 50 ? (context.external.closingLineScore - 0.5) * 0.025 : 0;
  const margin = round(clamp(0.045 + (1 - confidence) * 0.045 + (context.status === "live" ? 0.012 : 0) + context.external.marginBoost - calibrationDiscount, 0.035, 0.14), 3);
  const toOdds = (probability: number) => round(clamp(1 / (probability * (1 + margin)), 1.08, 18));
  const totalLineBase = context.sport === "soccer" || context.sport === "mlb" || context.sport === "nhl" || context.sport === "boxing"
    ? clamp(expectedTotal, profile.total * 0.55, profile.total * 1.65)
    : clamp(expectedTotal, profile.total * 0.75, profile.total * 1.25);
  const totalLine = Math.round(totalLineBase * 2) / 2;
  const overProb = soccer?.overTwoPointFive ?? clamp(0.5 + (expectedTotal - profile.total) / (profile.total * 7), 0.38, 0.62);
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
    liveStats,
    meta: {
      version: modelVersion,
      confidence: round(confidence),
      dataQuality: round(dataQuality),
      margin,
      signals: [
        "public-scoreboard",
        "regularized-team-record",
        "sport-scoring-profile",
        "league-strength",
        "home-advantage",
        "time-to-start",
        ...(context.sport === "soccer" ? ["poisson-score-distribution"] : []),
        ...(liveStats ? ["verified-live-stats"] : []),
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

function isoDateKey(date: string) {
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function teamSimilarity(a = "", b = "") {
  const first = normalizeName(a);
  const second = normalizeName(b);
  if (!first || !second) return 0;
  if (first === second) return 1;
  if (first.includes(second) || second.includes(first)) return 0.88;
  const chunks: string[][] = [first, second].map((value) => value.match(/[a-z]+|\d+/g) ?? []);
  const shared = chunks[0].filter((chunk) => chunks[1].includes(chunk)).length;
  return shared / Math.max(1, Math.max(chunks[0].length, chunks[1].length));
}

function statNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(String(value).replace("%", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function statValue(teamStats: ApiFootballTeamStatistics | undefined, label: string) {
  const key = normalizeName(label);
  const item = teamStats?.statistics?.find((stat) => normalizeName(stat.type ?? "") === key);
  return statNumber(item?.value);
}

async function apiFootballFetch<T>(path: string, params: Record<string, string>) {
  if (!apiFootballKey) return null;
  const url = new URL(`https://v3.football.api-sports.io/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "x-apisports-key": apiFootballKey },
  });
  if (!response.ok) return null;
  return (await response.json()) as { response?: T };
}

async function getApiFootballLiveFixtures() {
  if (!apiFootballKey) return [];
  if (apiFootballFixtureCache && apiFootballFixtureCache.expiresAt > Date.now()) return apiFootballFixtureCache.data;
  const payload = await apiFootballFetch<ApiFootballFixture[]>("fixtures", { live: "all" });
  const fixtures = payload?.response ?? [];
  apiFootballFixtureCache = { expiresAt: Date.now() + scoreboardCacheTtlMs, data: fixtures };
  return fixtures;
}

function normalizeApiFootballStats(fixture: ApiFootballFixture, stats: ApiFootballTeamStatistics[]) {
  const homeName = fixture.teams?.home?.name ?? "";
  const awayName = fixture.teams?.away?.name ?? "";
  const homeStats = stats.find((item) => teamSimilarity(item.team?.name, homeName) > 0.7) ?? stats[0];
  const awayStats = stats.find((item) => teamSimilarity(item.team?.name, awayName) > 0.7) ?? stats[1];
  if (!homeStats || !awayStats) return null;

  const possessionHome = clamp(statValue(homeStats, "Ball Possession"), 0, 100);
  const possessionAway = clamp(statValue(awayStats, "Ball Possession"), 0, 100);
  const xgHome = statValue(homeStats, "expected_goals") || statValue(homeStats, "Expected Goals");
  const xgAway = statValue(awayStats, "expected_goals") || statValue(awayStats, "Expected Goals");
  const shotsHome = Math.round(statValue(homeStats, "Total Shots"));
  const shotsAway = Math.round(statValue(awayStats, "Total Shots"));
  const shotsOnTargetHome = Math.round(statValue(homeStats, "Shots on Goal"));
  const shotsOnTargetAway = Math.round(statValue(awayStats, "Shots on Goal"));
  const dangerousHome = Math.round(statValue(homeStats, "Dangerous Attacks"));
  const dangerousAway = Math.round(statValue(awayStats, "Dangerous Attacks"));
  const cornersHome = Math.round(statValue(homeStats, "Corner Kicks"));
  const cornersAway = Math.round(statValue(awayStats, "Corner Kicks"));
  const pressureTotal = Math.max(1, shotsHome + shotsAway + dangerousHome + dangerousAway + cornersHome + cornersAway);
  const homePressure = (shotsHome + dangerousHome + cornersHome * 2) / pressureTotal;
  const momentumHome = Math.round(clamp(possessionHome * 0.35 + homePressure * 65, 0, 100));
  const momentumAway = Math.round(clamp(100 - momentumHome, 0, 100));
  const heatmapHome = Array.isArray((homeStats as { heatmap?: number[] }).heatmap) ? normalizeHeatmap((homeStats as { heatmap?: number[] }).heatmap) : undefined;
  const heatmapAway = Array.isArray((awayStats as { heatmap?: number[] }).heatmap) ? normalizeHeatmap((awayStats as { heatmap?: number[] }).heatmap) : undefined;

  if (possessionHome + possessionAway <= 0 && shotsHome + shotsAway <= 0 && cornersHome + cornersAway <= 0) return null;

  return {
    source: "api-football" as const,
    possession: { home: Math.round(possessionHome), away: Math.round(possessionAway) },
    ...(xgHome || xgAway ? { xg: { home: round(xgHome), away: round(xgAway) } } : {}),
    shots: { home: Math.max(0, shotsHome), away: Math.max(0, shotsAway) },
    shotsOnTarget: { home: Math.max(0, shotsOnTargetHome), away: Math.max(0, shotsOnTargetAway) },
    dangerousAttacks: { home: Math.max(0, dangerousHome), away: Math.max(0, dangerousAway) },
    corners: { home: Math.max(0, cornersHome), away: Math.max(0, cornersAway) },
    momentum: { home: momentumHome, away: momentumAway },
    ...(heatmapHome && heatmapAway ? { heatmap: { home: heatmapHome, away: heatmapAway } } : {}),
    updatedAt: new Date().toISOString(),
  };
}

async function getApiFootballLiveStats() {
  if (!apiFootballKey) return new Map<number, NonNullable<Match["liveStats"]>>();
  if (apiFootballStatsCache && apiFootballStatsCache.expiresAt > Date.now()) return apiFootballStatsCache.data;
  const fixtures = await getApiFootballLiveFixtures();
  const liveFixtures = fixtures.filter((fixture) => fixture.fixture?.id);
  const maxStatCalls = Math.max(1, Number(process.env.API_FOOTBALL_STATS_REFRESH_LIMIT ?? 8));
  const entries = await Promise.all(
    liveFixtures.slice(0, maxStatCalls).map(async (fixture) => {
      const fixtureId = fixture.fixture?.id;
      if (!fixtureId) return null;
      const payload = await apiFootballFetch<ApiFootballTeamStatistics[]>("fixtures/statistics", { fixture: String(fixtureId) });
      const stats = normalizeApiFootballStats(fixture, payload?.response ?? []);
      return stats ? ([fixtureId, stats] as const) : null;
    }),
  );
  const mapped = new Map<number, NonNullable<Match["liveStats"]>>();
  for (const entry of entries) {
    if (entry) mapped.set(entry[0], entry[1]);
  }
  apiFootballStatsCache = { expiresAt: Date.now() + scoreboardCacheTtlMs, data: mapped };
  return mapped;
}

async function findApiFootballStatsForMatch(home: string, away: string, startsAt: string, status: Match["status"]) {
  if (!apiFootballKey || status !== "live") return undefined;
  const fixtures = await getApiFootballLiveFixtures();
  const eventDate = isoDateKey(startsAt);
  const fixture = fixtures.find((item) => {
    const fixtureDate = isoDateKey(item.fixture?.date ?? "");
    if (fixtureDate && eventDate && fixtureDate !== eventDate) return false;
    return teamSimilarity(item.teams?.home?.name, home) > 0.72 && teamSimilarity(item.teams?.away?.name, away) > 0.72;
  });
  const fixtureId = fixture?.fixture?.id;
  if (!fixtureId) return undefined;
  return (await getApiFootballLiveStats()).get(fixtureId);
}

function apiFootballDateKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function apiFootballStatus(status?: string): Match["status"] {
  const code = status ?? "";
  if (["1H", "2H", "ET", "BT", "P", "LIVE", "HT", "INT"].includes(code)) return "live";
  if (["FT", "AET", "PEN"].includes(code)) return "finished";
  if (["PST", "CANC", "ABD", "AWD", "WO"].includes(code)) return "postponed";
  return "upcoming";
}

function normalizeApiFootballFixture(fixture: ApiFootballFixture): Match | null {
  const fixtureId = fixture.fixture?.id;
  const startsAt = fixture.fixture?.date;
  const home = fixture.teams?.home?.name;
  const away = fixture.teams?.away?.name;
  if (!fixtureId || !startsAt || !home || !away) return null;

  const status = apiFootballStatus(fixture.fixture?.status?.short);
  if (status === "finished" || status === "postponed") return null;

  const hasScore = fixture.goals?.home !== null && fixture.goals?.home !== undefined && fixture.goals?.away !== null && fixture.goals?.away !== undefined;
  const external = emptyExternalSignals({ injury: "missing", news: "missing", sharp: "missing", history: "missing", stats: "missing" });
  const pricing = modelOdds({
    sport: "soccer",
    league: fixture.league?.name ?? "Football",
    startsAt,
    status,
    minute: fixture.fixture?.status?.elapsed ? `${fixture.fixture.status.elapsed}'` : fixture.fixture?.status?.short,
    home: { name: home, score: fixture.goals?.home ?? 0, homeAway: "home" },
    away: { name: away, score: fixture.goals?.away ?? 0, homeAway: "away" },
    external,
  });

  return {
    id: `api-football-${fixtureId}`,
    sport: "soccer",
    league: fixture.league?.name ?? "Football",
    country: fixture.league?.country ?? "World",
    home,
    away,
    startsAt,
    status,
    marketSource: "henriquinho-model",
    marketStatus: status === "live" || status === "upcoming" ? "open" : "closed",
    provider: "henriquinho-model",
    providerEventId: String(fixtureId),
    providerLastUpdated: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    minute: fixture.fixture?.status?.elapsed ? `${fixture.fixture.status.elapsed}'` : undefined,
    score: hasScore && status === "live" ? `${fixture.goals?.home} - ${fixture.goals?.away}` : undefined,
    odds: pricing.odds,
    liveStats: pricing.liveStats,
    oddsSource: "model-provider",
    oddsProvider: "Henriquinho odds from API-Football real fixtures",
    oddsUpdatedAt: new Date().toISOString(),
    model: {
      ...pricing.meta,
      signals: ["api-football-fixture-snapshot", ...pricing.meta.signals.filter((signal) => signal !== "public-scoreboard")],
    },
    risk: pricing.risk,
    trader: pricing.trader,
    source: "api-football",
  };
}

async function getApiFootballSnapshotOdds() {
  if (!apiFootballKey) throw new Error("API_FOOTBALL_KEY is missing");
  if (apiFootballSnapshotCache && apiFootballSnapshotCache.expiresAt > Date.now()) return apiFootballSnapshotCache.data;

  const payload = await apiFootballFetch<ApiFootballFixture[]>("fixtures", {
    date: apiFootballDateKey(),
    timezone: "America/New_York",
  });
  const matches = (payload?.response ?? [])
    .map(normalizeApiFootballFixture)
    .filter((match): match is Match => Boolean(match))
    .sort((a, b) => {
      if (a.status === "live" && b.status !== "live") return -1;
      if (a.status !== "live" && b.status === "live") return 1;
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
    });

  apiFootballSnapshotCache = { expiresAt: Date.now() + apiFootballSnapshotCacheTtlMs, data: matches };
  return matches;
}

async function normalizeFallbackEvent(event: EspnEvent, config: (typeof fallbackScoreboardEndpoints)[number], licensed: Awaited<ReturnType<typeof getLicensedSignals>>): Promise<Match | null> {
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
  const external = externalSignalsForEvent(event.id, home.team.displayName, away.team.displayName, licensed);
  external.stats = external.stats ?? await findApiFootballStatsForMatch(home.team.displayName, away.team.displayName, event.date, status);
  const pricing = modelOdds({
    sport: config.sport,
    league: config.league,
    startsAt: event.date,
    status,
    minute: competition?.status?.type?.shortDetail ?? competition?.status?.displayClock,
    home: { name: home.team.displayName, record: home.records?.[0]?.summary, score: Number(home.score ?? 0), homeAway: "home" },
    away: { name: away.team.displayName, record: away.records?.[0]?.summary, score: Number(away.score ?? 0), homeAway: "away" },
    external,
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
    marketSource: "henriquinho-model",
    marketStatus: status === "live" || status === "upcoming" ? "open" : "closed",
    provider: "henriquinho-model",
    providerEventId: event.id,
    providerLastUpdated: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    minute: competition?.status?.type?.shortDetail ?? competition?.status?.displayClock,
    score: hasScore ? `${home.score} - ${away.score}` : undefined,
    odds: pricing.odds,
    liveStats: pricing.liveStats,
    oddsSource: "model-provider",
    oddsProvider: `${modelVersion} open model`,
    oddsUpdatedAt: new Date().toISOString(),
    model: pricing.meta,
    risk: pricing.risk,
    trader: pricing.trader,
    source: "henriquinho-model",
  };
}

function utcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function resetSnapshotDailyCounter(now = new Date()) {
  const key = utcDayKey(now);
  if (pregameSnapshotDailyKey !== key) {
    pregameSnapshotDailyKey = key;
    pregameSnapshotDailyRequests = 0;
  }
}

function nextSnapshotRefreshAt(now = Date.now()) {
  const interval = 2 * 60 * 60 * 1000;
  return new Date((Math.floor(now / interval) + 1) * interval).toISOString();
}

async function snapshotMatchesForPlayers(now = Date.now()) {
  const persisted = await readPersistedOddsSnapshot();
  const snapshot = persisted ? { expiresAt: persisted.expiresAt, data: persisted.matches } : pregameSnapshot;
  if (!snapshot) return [];
  return snapshot.data.map((match) => {
    const reason = isMarketBettable(match, now, oddsPregameStaleMs, oddsLiveStaleMs) ? null : "Pregame bookmaker snapshot is no longer bettable";
    return reason ? suspendBookmakerMarkets([match], reason)[0] : match;
  });
}

export async function refreshPregameBookmakerSnapshot() {
  if (oddsOperationMode !== "pregame-snapshot") return { refreshed: false, reason: "Pregame snapshot mode is disabled" };
  if (oddsProvider !== "the-odds-api" || !oddsApiKey) {
    updateOddsHealth({ provider: oddsProvider, configured: false, status: "unconfigured", lastError: "THE_ODDS_API_KEY is not configured" });
    return { refreshed: false, reason: "Bookmaker provider is not configured" };
  }
  resetSnapshotDailyCounter();
  const blocked = snapshotRefreshBlockReason({ refreshInFlight: pregameSnapshotRefreshInFlight, dailyRequests: pregameSnapshotDailyRequests, dailyLimit: oddsDailyRequestLimit, reserveCredits: oddsMonthlyCreditReserve });
  if (blocked) {
    updateOddsHealth({ provider: oddsProvider, configured: true, status: "degraded", lastError: blocked });
    return { refreshed: false, reason: blocked };
  }
  if (Date.now() < oddsProviderBlockedUntil) return { refreshed: false, reason: oddsProviderBlockedReason ?? "Bookmaker provider is temporarily paused" };

  pregameSnapshotRefreshInFlight = true;
  try {
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${process.env.ODDS_PROVIDER_SPORT ?? "upcoming"}/odds`);
    url.searchParams.set("apiKey", oddsApiKey);
    url.searchParams.set("regions", oddsRegions);
    url.searchParams.set("markets", "h2h");
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("dateFormat", "iso");
    if (!isPregameSnapshotRequest({ sport: process.env.ODDS_PROVIDER_SPORT ?? "upcoming", regions: oddsRegions, markets: "h2h", oddsFormat: "decimal" })) {
      return { refreshed: false, reason: "Pregame snapshot provider configuration is invalid" };
    }
    pregameSnapshotDailyRequests += 1;
    const result = await requestProviderJson<OddsApiEvent[]>(url.toString(), { timeoutMs: oddsProviderTimeoutMs, maxRetries: 0 });
    updateOddsHealth({
      provider: oddsProvider,
      configured: true,
      remainingCredits: result.quota.remainingCredits,
      usedCredits: result.quota.usedCredits,
      lastRequestCost: result.quota.lastRequestCost,
      dailyRequestsUsed: pregameSnapshotDailyRequests,
      dailyRequestLimit: oddsDailyRequestLimit,
      monthlyCreditReserve: oddsMonthlyCreditReserve,
      operationMode: "pregame-snapshot",
      nextScheduledSyncAt: nextSnapshotRefreshAt(),
    });
    if (!result.data) {
      const exhausted = result.exhausted || result.rateLimited || (result.quota.remainingCredits !== undefined && result.quota.remainingCredits <= oddsMonthlyCreditReserve);
      if (exhausted) {
        oddsProviderBlockedUntil = Date.now() + oddsErrorCacheTtlMs;
        oddsProviderBlockedReason = result.error ?? "Provider quota safety circuit breaker is active";
      }
      updateOddsHealth({ provider: oddsProvider, configured: true, status: result.exhausted ? "quota_exhausted" : result.rateLimited ? "rate_limited" : "error", lastError: result.error });
      return { refreshed: false, reason: result.error ?? "Provider request failed" };
    }
    if (result.quota.remainingCredits !== undefined && result.quota.remainingCredits <= oddsMonthlyCreditReserve) {
      oddsProviderBlockedUntil = Date.now() + oddsErrorCacheTtlMs;
      oddsProviderBlockedReason = `Provider reserve reached (${result.quota.remainingCredits} credits remaining)`;
    }
    const matches = dedupeProviderEvents(result.data
      .map((event) => {
        const config = realOddsSports.find((sport) => sport.key === event.sport_key);
        return config ? normalizeOddsEvent(event, config) : null;
      })
      .filter((match): match is Match => Boolean(match)));
    pregameSnapshot = { expiresAt: Date.now() + oddsBookmakerMaxAgeMs, data: matches };
    await writePersistedOddsSnapshot({ matches, expiresAt: pregameSnapshot.expiresAt, fetchedAt: new Date().toISOString() });
    recordOddsHealth(matches, Date.now(), oddsPregameStaleMs, oddsLiveStaleMs);
    updateOddsHealth({ provider: oddsProvider, configured: true, status: "healthy", lastSuccessfulRequestAt: new Date().toISOString(), lastError: undefined });
    return { refreshed: true, markets: matches.length, nextRefreshAt: nextSnapshotRefreshAt() };
  } finally {
    pregameSnapshotRefreshInFlight = false;
  }
}

function relevantOddsSportKeys(referenceMatches: Match[]) {
  const current = referenceMatches.filter((match) => match.status === "live" || match.status === "upcoming");
  return new Set(
    realOddsSports
      .filter((config) => current.some((match) => match.sport === config.sport && match.league === config.league))
      .map((config) => config.key),
  );
}

async function getRealOdds(referenceMatches: Match[] = []) {
  if (oddsProvider !== "the-odds-api" || !oddsApiKey) {
    updateOddsHealth({ provider: oddsProvider, configured: false, status: "unconfigured", lastError: "THE_ODDS_API_KEY is not configured" });
    return null;
  }
  if (Date.now() < oddsProviderBlockedUntil) {
    updateOddsHealth({ provider: oddsProvider, configured: true, status: "degraded", blockedUntil: new Date(oddsProviderBlockedUntil).toISOString(), lastError: oddsProviderBlockedReason ?? undefined });
    throw new Error(oddsProviderBlockedReason ?? "The Odds API is temporarily unavailable");
  }

  const providerOptions = { timeoutMs: oddsProviderTimeoutMs, maxRetries: oddsProviderMaxRetries };
  const updateQuota = (quota: { remainingCredits?: number; usedCredits?: number; lastRequestCost?: number }) => {
    updateOddsHealth({ provider: oddsProvider, configured: true, remainingCredits: quota.remainingCredits, usedCredits: quota.usedCredits, lastRequestCost: quota.lastRequestCost });
    if (quota.remainingCredits !== undefined && quota.remainingCredits <= oddsProviderMinCredits) {
      oddsProviderBlockedUntil = Date.now() + oddsErrorCacheTtlMs;
      oddsProviderBlockedReason = `Provider credit safety threshold reached (${quota.remainingCredits} remaining)`;
    }
  };

  let activeKeys = activeSportsCache?.expiresAt && activeSportsCache.expiresAt > Date.now() ? activeSportsCache.data : null;
  if (!activeKeys) {
    const result = await requestProviderJson<Array<{ key: string; active: boolean }>>(`https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(oddsApiKey)}`, providerOptions);
    updateQuota(result.quota);
    if (!result.data) {
      const status = result.exhausted ? "quota_exhausted" : result.rateLimited ? "rate_limited" : "error";
      if (result.exhausted || result.rateLimited) {
        oddsProviderBlockedUntil = Date.now() + oddsErrorCacheTtlMs;
        oddsProviderBlockedReason = result.error ?? "Bookmaker provider unavailable";
      }
      updateOddsHealth({ provider: oddsProvider, configured: true, status, lastError: result.error });
      throw new Error(result.error ?? "The Odds API sports request failed");
    }
    activeKeys = new Set(result.data.filter((sport) => sport.active).map((sport) => sport.key));
    activeSportsCache = { expiresAt: Date.now() + 60 * 60 * 1000, data: activeKeys };
  }

  const relevantKeys = relevantOddsSportKeys(referenceMatches);
  const configs = realOddsSports
    .filter((config) => activeKeys?.has(config.key) && relevantKeys.has(config.key))
    .sort((a, b) => {
      const aRank = oddsRefreshPriority.indexOf(a.key as (typeof oddsRefreshPriority)[number]);
      const bRank = oddsRefreshPriority.indexOf(b.key as (typeof oddsRefreshPriority)[number]);
      return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank);
    })
    .slice(0, maxOddsSportsPerRefresh);

  const results: Array<{ matches: Match[]; error?: string }> = [];
  for (const config of configs) {
    if (Date.now() < oddsProviderBlockedUntil) break;
    const url = new URL(`https://api.the-odds-api.com/v4/sports/${config.key}/odds`);
    url.searchParams.set("apiKey", oddsApiKey);
    url.searchParams.set("regions", oddsRegions);
    url.searchParams.set("markets", oddsMarkets);
    url.searchParams.set("oddsFormat", "decimal");
    url.searchParams.set("dateFormat", "iso");
    const result = await requestProviderJson<OddsApiEvent[]>(url.toString(), providerOptions);
    updateQuota(result.quota);
    if (!result.data) {
      if (result.exhausted || result.rateLimited) {
        oddsProviderBlockedUntil = Date.now() + oddsErrorCacheTtlMs;
        oddsProviderBlockedReason = result.error ?? "Bookmaker provider unavailable";
      }
      results.push({ matches: [], error: `${config.key}: ${result.error ?? "provider error"}` });
      continue;
    }
    results.push({ matches: result.data.map((event) => normalizeOddsEvent(event, config)).filter((match): match is Match => Boolean(match)) });
  }
  const matches = dedupeProviderEvents(results.flatMap((result) => result.matches)).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const errors = results.map((result) => result.error).filter(Boolean) as string[];
  if (!matches.length && errors.length) {
    updateOddsHealth({ provider: oddsProvider, configured: true, status: oddsProviderBlockedUntil > Date.now() ? "degraded" : "error", lastError: errors.slice(0, 3).join("; ") });
    throw new Error(errors.slice(0, 3).join("; "));
  }
  updateOddsHealth({
    provider: oddsProvider,
    configured: true,
    status: oddsProviderBlockedUntil > Date.now() ? "degraded" : "healthy",
    lastSuccessfulRequestAt: new Date().toISOString(),
    lastError: errors[0],
    blockedUntil: oddsProviderBlockedUntil > Date.now() ? new Date(oddsProviderBlockedUntil).toISOString() : undefined,
  });
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
      const normalized = await Promise.all(Array.from(byId.values()).map((event) => normalizeFallbackEvent(event, config, licensed)));
      return normalized.filter(Boolean) as Match[];
    }),
  );
  const fallback = results.flat();
  fallbackCache = { expiresAt: nextMinuteBoundary(), data: fallback };
  return fallback;
}

function cachePayload(payload: OddsPayload, expiresAt: number) {
  responseCachedAt = Date.now();
  responseCache = { expiresAt, data: { ...payload, integrationVersion: "bookmaker-hardening-2026-07-13", fetchedAt: new Date(responseCachedAt).toISOString(), fallbackMode } };
  recordOddsHealth(responseCache.data.matches, responseCachedAt, oddsPregameStaleMs, oddsLiveStaleMs);
}

function suspendBookmakerMarkets(matches: Match[], reason: string) {
  return matches.map((match) => match.marketSource === "bookmaker" ? {
    ...match,
    marketStatus: "suspended" as const,
    suspensionReason: reason,
    trader: { controlled: match.trader?.controlled ?? false, ...match.trader, suspended: true, note: reason },
  } : match);
}

export async function GET() {
  if (internalSportsOnly) {
    const internal = getHenriquinhoInternalSports();
    const payload: OddsPayload = {
      source: "henriquinho-internal",
      oddsSource: "model-provider",
      configured: true,
      realOddsOnly: false,
      matches: internal.matches,
      message: "Henriquinho internal sports API loaded. No external sports providers are being used.",
    };
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=5" } });
  }

  // Player traffic is cache-only in snapshot mode. The only paid request is made
  // by the Vercel cron route below, never by this public endpoint.
  if (oddsOperationMode === "pregame-snapshot") {
    const bookmakerMatches = await snapshotMatchesForPlayers();
    if (bookmakerMatches.some((match) => match.marketStatus === "open")) {
      const payload: OddsPayload = {
        source: "odds-api",
        oddsSource: "real-provider",
        configured: Boolean(oddsApiKey),
        realOddsOnly,
        matches: bookmakerMatches,
        message: "Pregame bookmaker odds snapshot loaded.",
        fallbackMode,
      };
      recordOddsHealth(bookmakerMatches, Date.now(), oddsPregameStaleMs, oddsLiveStaleMs);
      return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=30" } });
    }
    const fallback = await getFallbackOdds().catch(() => []);
    const matches = realOddsOnly ? fallback.map(stripEstimatedMarkets) : fallback;
    const payload: OddsPayload = {
      source: realOddsOnly ? "espn-public" : "henriquinho-model",
      oddsSource: realOddsOnly ? "unavailable" : "model-provider",
      configured: Boolean(oddsApiKey),
      realOddsOnly,
      matches,
      message: fallbackMode === "model" ? "Henriquinho model markets loaded while the pregame bookmaker snapshot is unavailable." : "No current bookmaker snapshot is available.",
      fallbackMode,
    };
    recordOddsHealth(matches, Date.now(), oddsPregameStaleMs, oddsLiveStaleMs);
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=30" } });
  }

  // A fixture provider can supply real fixtures to the model, but it is never allowed
  // to pre-empt a configured bookmaker-odds provider.
  if (apiFootballRealSnapshot && fallbackMode === "model" && !oddsApiKey) {
    try {
      const matches = await getApiFootballSnapshotOdds();
      const payload: OddsPayload = {
        source: "api-football",
        oddsSource: "model-provider",
        configured: Boolean(apiFootballKey),
        realOddsOnly: false,
        matches,
        message: `API-Football real fixture snapshot loaded. Next upstream refresh is capped at ${Math.round(apiFootballSnapshotCacheTtlMs / 1000)} seconds.`,
      };
      return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=30" } });
    } catch (error) {
      const payload: OddsPayload = {
        source: "api-football",
        oddsSource: "model-provider",
        configured: Boolean(apiFootballKey),
        realOddsOnly: false,
        matches: [],
        message: "API-Football snapshot is unavailable. Add API_FOOTBALL_KEY to load real fixtures.",
        providerError: error instanceof Error ? error.message : "Unknown API-Football error",
      };
      return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=30" } });
    }
  }

  if (responseCache && responseCache.expiresAt > Date.now()) {
    updateOddsHealth({ cacheAgeMs: Date.now() - responseCachedAt });
    return NextResponse.json({ ...responseCache.data, cached: true }, { headers: { "Cache-Control": "private, max-age=10" } });
  }

  try {
    // The public scoreboard determines which sports are currently relevant. It is
    // never used to create or relabel a bookmaker market, and it prevents provider
    // credits being spent on an in-season sport with no current event.
    const fallback = await getFallbackOdds().catch(() => []);
    const realOdds = await getRealOdds(fallback);
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
      const refreshMs = realOdds.matches.some((match) => match.status === "live") ? oddsLiveRefreshMs : oddsPregameRefreshMs;
      cachePayload(payload, nextRefreshBoundary(refreshMs));
      lastGoodRealOdds = payload;
      return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=10" } });
    }

    const matches = realOddsOnly ? fallback.map(stripEstimatedMarkets) : fallback;
    const payload: OddsPayload = {
      source: realOddsOnly ? "espn-public" : "henriquinho-model",
      oddsSource: realOddsOnly ? "unavailable" : "model-provider",
      configured: Boolean(oddsApiKey),
      realOddsOnly,
      matches,
      message: realOddsOnly
        ? "No bookmaker odds are available right now. Showing real scoreboard events only."
        : oddsApiKey
        ? "Henriquinho model odds loaded while bookmaker odds are unavailable."
        : "Henriquinho model odds loaded. Add THE_ODDS_API_KEY for bookmaker odds.",
      providerError: oddsApiKey ? "The Odds API returned no active bookmaker odds for these events yet." : undefined,
    };
    cachePayload(payload, nextMinuteBoundary());
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=10" } });
  } catch (error) {
    if (lastGoodRealOdds) {
      const payload: OddsPayload = {
        ...lastGoodRealOdds,
        matches: suspendBookmakerMarkets(lastGoodRealOdds.matches, "Bookmaker provider refresh failed"),
        stale: true,
        message: "Bookmaker markets suspended while the provider refreshes.",
        providerError: error instanceof Error ? error.message : "Unknown odds provider error",
      };
      cachePayload(payload, nextMinuteBoundary());
      return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=10" } });
    }
    const fallback = await getFallbackOdds().catch(() => []);
    const matches = realOddsOnly ? fallback.map(stripEstimatedMarkets) : fallback;
    const payload: OddsPayload = {
      source: realOddsOnly ? "espn-public" : "henriquinho-model",
      oddsSource: realOddsOnly ? "unavailable" : "model-provider",
      configured: Boolean(oddsApiKey),
      realOddsOnly,
      matches,
      message: realOddsOnly
        ? "Bookmaker odds are unavailable. Showing real scoreboard events only."
        : oddsApiKey && error instanceof Error && error.message.includes("OUT_OF_USAGE_CREDITS")
        ? "Henriquinho model odds loaded. Bookmaker odds quota is used up."
        : oddsApiKey ? "Henriquinho model odds loaded while bookmaker odds refresh." : "Henriquinho model odds loaded. Add a real key for bookmaker odds.",
      providerError: error instanceof Error ? error.message : "Unknown odds provider error",
    };
    if (payload.providerError?.includes("OUT_OF_USAGE_CREDITS")) {
      oddsProviderBlockedUntil = Date.now() + oddsErrorCacheTtlMs;
      oddsProviderBlockedReason = payload.providerError;
    }
    cachePayload(payload, realOddsOnly ? Date.now() + oddsErrorCacheTtlMs : nextMinuteBoundary());
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, max-age=10" } });
  }
}
