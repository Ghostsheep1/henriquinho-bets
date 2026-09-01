import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { refreshPregameBookmakerSnapshot } from "@/app/api/odds/route";
import { isModelOnlyMode } from "@/lib/odds/config";

export const dynamic = "force-dynamic";

const githubActionsIssuer = "https://token.actions.githubusercontent.com";
const githubActionsJwks = createRemoteJWKSet(new URL(`${githubActionsIssuer}/.well-known/jwks`));
const githubActionsAudience = "henriquinho-bets-snapshot";
const repository = "Ghostsheep1/henriquinho-bets";
const workflowRef = `${repository}/.github/workflows/odds-snapshot.yml@refs/heads/main`;

async function hasGitHubActionsIdentity(authorization: string | null) {
  if (!authorization?.startsWith("Bearer ")) return false;
  try {
    const { payload } = await jwtVerify(authorization.slice("Bearer ".length), githubActionsJwks, {
      issuer: githubActionsIssuer,
      audience: githubActionsAudience,
    });
    return payload.repository === repository
      && payload.workflow_ref === workflowRef
      && payload.ref === "refs/heads/main"
      && (payload.event_name === "schedule" || payload.event_name === "workflow_dispatch");
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  const isLegacyCronRequest = Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
  if (!isLegacyCronRequest && !(await hasGitHubActionsIdentity(authorization))) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  if (isModelOnlyMode()) return NextResponse.json({ refreshed: false, reason: "Model-only mode" }, { headers: { "Cache-Control": "private, no-store" } });
  const result = await refreshPregameBookmakerSnapshot();
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
