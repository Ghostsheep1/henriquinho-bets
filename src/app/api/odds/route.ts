import { NextResponse } from "next/server";
import type { Match, SportKey } from "@/lib/types";

const endpoints: Array<{ url: string; sport: SportKey; league: string; country: string; dateWindow?: boolean }> = [
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

function normalizeEvent(event: EspnEvent, config: (typeof endpoints)[number]): Match | null {
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
    source: "espn-public",
  };
}

export async function GET() {
  try {
    const results = await Promise.all(
      endpoints.map(async (config) => {
        const urls = config.dateWindow ? dateKeys().map((date) => `${config.url}?dates=${date}`) : [config.url];
        const payloads = await Promise.all(
          urls.map(async (url) => {
            const response = await fetch(url, { next: { revalidate: 60 } });
            if (!response.ok) return [];
            const payload = (await response.json()) as { events?: EspnEvent[] };
            return payload.events ?? [];
          }),
        );
        const byId = new Map<string, EspnEvent>();
        payloads.flat().forEach((event) => byId.set(event.id, event));
        return Array.from(byId.values()).map((event) => normalizeEvent(event, config)).filter(Boolean) as Match[];
      }),
    );
    return NextResponse.json({ source: "espn-public", configured: true, matches: results.flat(), message: "ok" });
  } catch {
    return NextResponse.json({ source: "espn-public", configured: true, matches: [], message: "Scores updating soon" });
  }
}
