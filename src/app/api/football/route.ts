import { NextResponse } from "next/server";
import type { Match } from "@/lib/types";

const featuredTournaments = [
  { slug: "fifa.world", league: "FIFA World Cup", country: "World" },
  { slug: "uefa.euro", league: "UEFA Euro", country: "Europe" },
  { slug: "fifa.olympics", league: "Olympic Soccer", country: "World" },
  { slug: "fifa.wwc", league: "FIFA Women's World Cup", country: "World" },
] as const;

const stalePastWindowMs = 48 * 60 * 60 * 1000;
const futureWindowDays = 4;

type EspnEvent = {
  id: string;
  date: string;
  competitions?: Array<{
    status?: { type?: { state?: string; completed?: boolean; shortDetail?: string }; displayClock?: string };
    competitors?: Array<{ homeAway: "home" | "away"; score?: string; team: { displayName: string } }>;
  }>;
};

function dateKeys() {
  return Array.from({ length: futureWindowDays + 1 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + index);
    return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  });
}

function normalizeTournament(event: EspnEvent, tournament: (typeof featuredTournaments)[number]): Match | null {
  const competition = event.competitions?.[0];
  const home = competition?.competitors?.find((item) => item.homeAway === "home");
  const away = competition?.competitors?.find((item) => item.homeAway === "away");
  if (!home || !away) return null;
  const status: Match["status"] = competition?.status?.type?.completed ? "finished" : competition?.status?.type?.state === "in" ? "live" : "upcoming";
  const startsAt = new Date(event.date).getTime();
  if (Number.isFinite(startsAt) && startsAt < Date.now() - stalePastWindowMs && status !== "live") return null;
  const hasScore = home.score !== undefined && away.score !== undefined && (status === "live" || status === "finished");
  return {
    id: `espn-${tournament.slug}-${event.id}`,
    sport: "soccer",
    league: tournament.league,
    country: tournament.country,
    home: home.team.displayName,
    away: away.team.displayName,
    startsAt: event.date,
    status,
    minute: competition?.status?.type?.shortDetail ?? competition?.status?.displayClock,
    score: hasScore ? `${home.score} - ${away.score}` : undefined,
    source: "espn-public",
  };
}

export async function GET() {
  try {
    const results = await Promise.all(
      featuredTournaments.map(async (tournament) => {
        const responses = await Promise.all(
          dateKeys().map(async (date) => {
            const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${tournament.slug}/scoreboard?dates=${date}`, { next: { revalidate: 60 } });
            if (!response.ok) return [];
            const payload = (await response.json()) as { events?: EspnEvent[] };
            return payload.events ?? [];
          }),
        );
        const byId = new Map<string, EspnEvent>();
        responses.flat().forEach((event) => byId.set(event.id, event));
        return Array.from(byId.values()).map((event) => normalizeTournament(event, tournament)).filter(Boolean) as Match[];
      }),
    );
    const tournaments = results.flat().sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    return NextResponse.json({ source: "espn-public", configured: true, worldCup: tournaments, matches: tournaments, message: "ok" });
  } catch {
    return NextResponse.json({ source: "espn-public", configured: true, matches: [], worldCup: [], message: "Scores updating soon" });
  }
}
