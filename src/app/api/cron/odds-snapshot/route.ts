import { NextResponse } from "next/server";
import { refreshPregameBookmakerSnapshot } from "@/app/api/odds/route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  const result = await refreshPregameBookmakerSnapshot();
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
