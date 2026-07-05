import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const buildVersion =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_APP_VERSION ??
  "local-dev";

export async function GET() {
  return NextResponse.json(
    { version: buildVersion },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    },
  );
}
