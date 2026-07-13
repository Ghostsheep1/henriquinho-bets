import { NextResponse } from "next/server";
import { getOddsHealth } from "@/lib/odds/healthStore";

export const dynamic = "force-dynamic";

const pregameStaleMs = Math.max(60_000, Number(process.env.ODDS_PREGAME_STALE_MS ?? 15 * 60_000));
const liveStaleMs = Math.max(15_000, Number(process.env.ODDS_LIVE_STALE_MS ?? 90_000));

export async function GET(request: Request) {
  const adminToken = process.env.ODDS_HEALTH_ADMIN_TOKEN;
  if (!adminToken || request.headers.get("x-odds-health-token") !== adminToken) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json({
    health: getOddsHealth(Date.now(), pregameStaleMs, liveStaleMs),
    thresholds: { pregameStaleMs, liveStaleMs },
  }, { headers: { "Cache-Control": "private, no-store" } });
}
