import type { Match, SportKey } from "@/lib/types";

const version = "HENRIQUINHO-INTERNAL-SPORTS-1.0";

type TeamPool = {
  sport: SportKey;
  league: string;
  country: string;
  teams: string[];
};

const pools: TeamPool[] = [
  { sport: "soccer", league: "FIFA World Cup", country: "World", teams: ["Brazil", "France", "Argentina", "Portugal", "Spain", "England", "United States", "Morocco", "Japan", "Uruguay", "Colombia", "Netherlands"] },
  { sport: "soccer", league: "UEFA Euro", country: "Europe", teams: ["Germany", "Italy", "Belgium", "Croatia", "Switzerland", "Denmark", "Austria", "Türkiye", "Norway", "Poland"] },
  { sport: "soccer", league: "Premier League", country: "England", teams: ["Manchester City", "Arsenal", "Liverpool", "Chelsea", "Tottenham", "Manchester United", "Newcastle", "Aston Villa"] },
  { sport: "soccer", league: "La Liga", country: "Spain", teams: ["Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Real Sociedad", "Villarreal", "Valencia", "Athletic Club"] },
  { sport: "soccer", league: "Serie A", country: "Italy", teams: ["Inter Milan", "AC Milan", "Juventus", "Napoli", "Roma", "Lazio", "Atalanta", "Fiorentina"] },
  { sport: "soccer", league: "Copa Libertadores", country: "South America", teams: ["Flamengo", "Palmeiras", "Boca Juniors", "River Plate", "Fluminense", "Sao Paulo", "Botafogo", "Atletico Mineiro"] },
  { sport: "nba", league: "NBA", country: "USA", teams: ["Boston Celtics", "Los Angeles Lakers", "Denver Nuggets", "New York Knicks", "Miami Heat", "Golden State Warriors", "Dallas Mavericks", "Phoenix Suns"] },
  { sport: "nfl", league: "NFL", country: "USA", teams: ["Kansas City Chiefs", "Philadelphia Eagles", "Buffalo Bills", "Dallas Cowboys", "San Francisco 49ers", "Baltimore Ravens", "Detroit Lions", "Green Bay Packers"] },
  { sport: "mlb", league: "MLB", country: "USA", teams: ["New York Yankees", "Los Angeles Dodgers", "Boston Red Sox", "Chicago Cubs", "Houston Astros", "Atlanta Braves", "New York Mets", "Toronto Blue Jays"] },
  { sport: "nhl", league: "NHL", country: "USA/Canada", teams: ["Florida Panthers", "Edmonton Oilers", "Toronto Maple Leafs", "New York Rangers", "Boston Bruins", "Colorado Avalanche", "Vegas Golden Knights", "Dallas Stars"] },
  { sport: "mma", league: "UFC/MMA", country: "Global", teams: ["Alex Pereira", "Jon Jones", "Islam Makhachev", "Ilia Topuria", "Sean O'Malley", "Khamzat Chimaev", "Leon Edwards", "Tom Aspinall"] },
  { sport: "tennis", league: "Tennis", country: "Global", teams: ["Carlos Alcaraz", "Jannik Sinner", "Novak Djokovic", "Daniil Medvedev", "Iga Swiatek", "Aryna Sabalenka", "Coco Gauff", "Elena Rybakina"] },
  { sport: "boxing", league: "Boxing", country: "Global", teams: ["Oleksandr Usyk", "Tyson Fury", "Canelo Alvarez", "Terence Crawford", "Naoya Inoue", "Gervonta Davis", "Dmitry Bivol", "Artur Beterbiev"] },
];

const profiles: Record<SportKey, { draw: number; total: number; spread: number; liveMinutes: number; scoreUnit: number }> = {
  soccer: { draw: 0.25, total: 2.5, spread: 0.5, liveMinutes: 90, scoreUnit: 1 },
  nba: { draw: 0, total: 222.5, spread: 5.5, liveMinutes: 48, scoreUnit: 2 },
  nfl: { draw: 0, total: 44.5, spread: 3.5, liveMinutes: 60, scoreUnit: 3 },
  mlb: { draw: 0, total: 8.5, spread: 1.5, liveMinutes: 9, scoreUnit: 1 },
  nhl: { draw: 0, total: 6, spread: 1.5, liveMinutes: 60, scoreUnit: 1 },
  mma: { draw: 0, total: 2.5, spread: 0.5, liveMinutes: 25, scoreUnit: 1 },
  tennis: { draw: 0, total: 22.5, spread: 2.5, liveMinutes: 120, scoreUnit: 1 },
  formula1: { draw: 0, total: 0.5, spread: 0.5, liveMinutes: 120, scoreUnit: 1 },
  boxing: { draw: 0.03, total: 8.5, spread: 0.5, liveMinutes: 36, scoreUnit: 1 },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function hashUnit(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value));
}

function normalize(probabilities: number[]) {
  const total = probabilities.reduce((sum, value) => sum + value, 0);
  return total > 0 ? probabilities.map((value) => value / total) : probabilities.map(() => 1 / probabilities.length);
}

function decimalFromProbability(probability: number, margin: number) {
  return round(clamp(1 / (probability * (1 + margin)), 1.08, 18));
}

function kickoffFor(index: number) {
  const now = new Date();
  const minutesFromNow = index < 4 ? -20 + index * 11 : 40 + index * 175;
  const date = new Date(now.getTime() + minutesFromNow * 60 * 1000);
  date.setSeconds(0, 0);
  return date;
}

function recordFor(seed: string) {
  const wins = 6 + Math.floor(hashUnit(`${seed}:wins`) * 14);
  const losses = 3 + Math.floor(hashUnit(`${seed}:losses`) * 10);
  const draws = Math.floor(hashUnit(`${seed}:draws`) * 5);
  return `${wins}-${losses}-${draws}`;
}

function scoreFor(sport: SportKey, seed: string, minuteRatio: number) {
  const profile = profiles[sport];
  if (sport === "nba") return Math.round((72 + hashUnit(seed) * 38) * minuteRatio);
  if (sport === "nfl") return Math.round((10 + hashUnit(seed) * 24) * minuteRatio);
  if (sport === "mlb") return Math.round((2 + hashUnit(seed) * 8) * minuteRatio);
  if (sport === "nhl") return Math.round((1 + hashUnit(seed) * 5) * minuteRatio);
  if (sport === "tennis") return Math.round((6 + hashUnit(seed) * 18) * minuteRatio);
  if (sport === "mma" || sport === "boxing") return Math.round(hashUnit(seed) * 2 * minuteRatio);
  return Math.round((hashUnit(seed) * 3.2 + 0.15) * minuteRatio * profile.scoreUnit);
}

function internalStats(sport: SportKey, seed: string, homeProb: number, awayProb: number, minuteRatio: number): NonNullable<Match["liveStats"]> {
  const possessionHome = Math.round(clamp(50 + (homeProb - awayProb) * 26 + (hashUnit(`${seed}:pos`) - 0.5) * 8, 32, 68));
  const possessionAway = 100 - possessionHome;
  const xgHome = round(clamp((0.18 + homeProb * 1.7) * minuteRatio, 0.05, 4.5));
  const xgAway = round(clamp((0.18 + awayProb * 1.7) * minuteRatio, 0.05, 4.5));
  const shotsHome = Math.round((4 + homeProb * 12 + hashUnit(`${seed}:hshots`) * 5) * Math.max(0.25, minuteRatio));
  const shotsAway = Math.round((4 + awayProb * 12 + hashUnit(`${seed}:ashots`) * 5) * Math.max(0.25, minuteRatio));
  const sotHome = Math.round(shotsHome * clamp(0.28 + homeProb * 0.2, 0.25, 0.55));
  const sotAway = Math.round(shotsAway * clamp(0.28 + awayProb * 0.2, 0.25, 0.55));
  const momentumHome = Math.round(clamp(possessionHome * 0.42 + homeProb * 48 + hashUnit(`${seed}:hmom`) * 8, 5, 95));
  const momentumAway = Math.round(clamp(100 - momentumHome, 5, 95));
  const heat = (prefix: string) => Array.from({ length: 15 }, (_, index) => Math.round(clamp(15 + hashUnit(`${seed}:${prefix}:${index}`) * 85, 0, 100)));

  return {
    source: "henriquinho-internal",
    possession: { home: possessionHome, away: possessionAway },
    ...(sport === "soccer" ? { xg: { home: xgHome, away: xgAway } } : {}),
    shots: { home: shotsHome, away: shotsAway },
    shotsOnTarget: { home: sotHome, away: sotAway },
    dangerousAttacks: { home: Math.round(momentumHome * minuteRatio * 1.4), away: Math.round(momentumAway * minuteRatio * 1.4) },
    corners: { home: Math.round(xgHome * 1.8 + minuteRatio * 2), away: Math.round(xgAway * 1.8 + minuteRatio * 2) },
    momentum: { home: momentumHome, away: momentumAway },
    heatmap: { home: heat("home"), away: heat("away") },
    updatedAt: new Date().toISOString(),
  };
}

function makeMatch(pool: TeamPool, eventIndex: number, globalIndex: number): Match {
  const home = pool.teams[(eventIndex * 2) % pool.teams.length];
  const away = pool.teams[(eventIndex * 2 + 1 + Math.floor(eventIndex / 2)) % pool.teams.length];
  const startsAt = kickoffFor(globalIndex);
  const now = Date.now();
  const starts = startsAt.getTime();
  const profile = profiles[pool.sport];
  const live = starts <= now && now - starts < profile.liveMinutes * 60 * 1000;
  const minute = live ? Math.max(1, Math.min(profile.liveMinutes, Math.floor((now - starts) / 60000) + 1)) : undefined;
  const minuteRatio = minute ? clamp(minute / profile.liveMinutes, 0.05, 0.98) : 0.12;
  const seed = `${pool.sport}:${pool.league}:${home}:${away}:${startsAt.toISOString().slice(0, 13)}`;
  const homeRecord = recordFor(`${seed}:home`);
  const awayRecord = recordFor(`${seed}:away`);
  const homeRating = 0.32 + hashUnit(`${home}:rating`) * 0.58;
  const awayRating = 0.32 + hashUnit(`${away}:rating`) * 0.58;
  const powerGap = homeRating - awayRating + 0.08 + (live ? (scoreFor(pool.sport, `${seed}:home-score`, minuteRatio) - scoreFor(pool.sport, `${seed}:away-score`, minuteRatio)) * 0.08 : 0);
  const rawHome = sigmoid(powerGap * 2.4);
  const rawAway = 1 - rawHome;
  const closeness = 1 - Math.abs(rawHome - rawAway);
  const draw = profile.draw ? clamp(profile.draw * (0.75 + closeness * 0.5), 0.04, 0.32) : 0;
  const [homeProb, drawProb, awayProb] = draw
    ? normalize([rawHome * (1 - draw), draw, rawAway * (1 - draw)])
    : [clamp(rawHome, 0.05, 0.92), 0, clamp(rawAway, 0.05, 0.92)];
  const confidence = round(clamp(0.62 + Math.abs(homeProb - awayProb) * 0.2 - (live ? 0.06 : 0), 0.45, 0.9));
  const margin = round(clamp(0.055 + (live ? 0.015 : 0) + (1 - confidence) * 0.035, 0.045, 0.11), 3);
  const homeScore = live ? scoreFor(pool.sport, `${seed}:home-score`, minuteRatio) : undefined;
  const awayScore = live ? scoreFor(pool.sport, `${seed}:away-score`, minuteRatio) : undefined;
  const expectedTotal = profile.total + (homeRating + awayRating - 1) * (pool.sport === "soccer" ? 1.4 : 12) + (live ? (homeScore ?? 0) + (awayScore ?? 0) * 0.05 : 0);
  const totalLine = Math.round(clamp(expectedTotal, profile.total * 0.65, profile.total * 1.35) * 2) / 2;
  const spreadLine = round((homeProb >= awayProb ? -1 : 1) * clamp(Math.abs(homeProb - awayProb) * profile.spread * 3, profile.spread, profile.spread * 4), 1);

  return {
    id: `henq-internal-${globalIndex}-${pool.sport}-${eventIndex}`,
    sport: pool.sport,
    league: pool.league,
    country: pool.country,
    home,
    away: home === away ? `${away} II` : away,
    startsAt: startsAt.toISOString(),
    status: live ? "live" : "upcoming",
    minute: minute ? `${minute}'` : undefined,
    score: homeScore !== undefined && awayScore !== undefined ? `${homeScore} - ${awayScore}` : undefined,
    odds: {
      moneyline: {
        home: decimalFromProbability(homeProb, margin),
        ...(drawProb ? { draw: decimalFromProbability(drawProb, margin) } : {}),
        away: decimalFromProbability(awayProb, margin),
      },
      total: {
        line: totalLine,
        over: decimalFromProbability(clamp(0.5 + (expectedTotal - profile.total) / (profile.total * 8), 0.38, 0.62), margin),
        under: decimalFromProbability(clamp(0.5 - (expectedTotal - profile.total) / (profile.total * 8), 0.38, 0.62), margin),
      },
      handicap: { line: spreadLine, home: round(1.86 + clamp(awayProb - homeProb, -0.24, 0.28)), away: round(1.86 + clamp(homeProb - awayProb, -0.24, 0.28)) },
    },
    oddsSource: "model-provider",
    oddsProvider: "Henriquinho Internal Sports API",
    oddsUpdatedAt: new Date().toISOString(),
    liveStats: live ? internalStats(pool.sport, seed, homeProb, awayProb, minuteRatio) : undefined,
    model: {
      version,
      confidence,
      dataQuality: round(clamp(0.68 + confidence * 0.2, 0.55, 0.9)),
      margin,
      signals: ["internal-schedule", "internal-team-rating", "internal-live-state", "deterministic-market-movement"],
      feedStatus: { injury: "missing", news: "missing", sharp: "missing", history: "missing", stats: live ? "active" : "missing" },
      calibration: { closingLineScore: 0.5, sampleSize: 0 },
    },
    risk: {
      maxStake: Math.round(250 * confidence * (live ? 0.72 : 1)),
      exposureTier: live ? "high" : confidence > 0.75 ? "low" : "medium",
      reviewRequired: false,
      reasons: live ? ["live-market", "internal-market"] : ["internal-market"],
    },
    trader: { controlled: false },
    source: "henriquinho-internal",
  };
}

export function getHenriquinhoInternalSports() {
  const matches = pools.flatMap((pool, poolIndex) =>
    Array.from({ length: pool.sport === "soccer" ? 7 : 4 }, (_, eventIndex) => makeMatch(pool, eventIndex, poolIndex * 10 + eventIndex)),
  ).sort((a, b) => {
    if (a.status === "live" && b.status !== "live") return -1;
    if (a.status !== "live" && b.status === "live") return 1;
    return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  });

  return {
    version,
    generatedAt: new Date().toISOString(),
    matches,
  };
}
