import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    message:
      "Settlement worker placeholder ready. Connect this route to Supabase cron or Vercel cron to compare open bets against final ESPN results.",
  });
}
