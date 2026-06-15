import { NextResponse } from "next/server";
import type { Match } from "@/lib/types";

type EspnEvent = {
  id: string;
  date: string;
  competitions?: Array<{
    status?: { type?: { state?: string; completed?: boolean; shortDetail?: string }; displayClock?: string };
    competitors?: Array<{ homeAway: "home" | "away"; score?: string; team: { displayName: string } }>;
  }>;
};

function normalizeWorldCup(event: EspnEvent): Match | null {
  const competition = event.competitions?.[0];
  const home = competition?.competitors?.find((item) => item.homeAway === "home");
  const away = competition?.competitors?.find((item) => item.homeAway === "away");
  if (!home || !away) return null;
  const status: Match["status"] = competition?.status?.type?.completed ? "finished" : competition?.status?.type?.state === "in" ? "live" : "upcoming";
  const hasScore = home.score !== undefined && away.score !== undefined && (status === "live" || status === "finished");
  return {
    id: `espn-wc-${event.id}`,
    sport: "soccer",
    league: "FIFA World Cup",
    country: "World",
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
    const response = await fetch("https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard", { next: { revalidate: 60 } });
    if (!response.ok) throw new Error("ESPN World Cup request failed");
    const payload = (await response.json()) as { events?: EspnEvent[] };
    const worldCup = (payload.events ?? []).map(normalizeWorldCup).filter(Boolean) as Match[];
    return NextResponse.json({ source: "espn-public", configured: true, worldCup, matches: worldCup, message: "ok" });
  } catch {
    return NextResponse.json({ source: "espn-public", configured: true, matches: [], worldCup: [], message: "Scores updating soon" });
  }
}
