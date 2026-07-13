import type { Match } from "@/lib/types";

export type PersistedOddsSnapshot = {
  matches: Match[];
  expiresAt: number;
  fetchedAt: string;
};

const snapshotId = "pregame-bookmaker";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function configured() {
  return Boolean(supabaseUrl && serviceRoleKey && !supabaseUrl.includes("your-") && !serviceRoleKey.includes("your-"));
}

function headers(extra: Record<string, string> = {}) {
  return { apikey: serviceRoleKey!, authorization: `Bearer ${serviceRoleKey!}`, "content-type": "application/json", ...extra };
}

export async function readPersistedOddsSnapshot(): Promise<PersistedOddsSnapshot | null> {
  if (!configured()) return null;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/odds_snapshots?id=eq.${snapshotId}&select=matches,expires_at,fetched_at`, { headers: headers(), cache: "no-store" });
    if (!response.ok) return null;
    const rows = await response.json() as Array<{ matches?: Match[]; expires_at?: string; fetched_at?: string }>;
    const row = rows[0];
    const expiresAt = new Date(row?.expires_at ?? "").getTime();
    if (!row?.matches || !Number.isFinite(expiresAt)) return null;
    return { matches: row.matches, expiresAt, fetchedAt: row.fetched_at ?? new Date(expiresAt).toISOString() };
  } catch {
    return null;
  }
}

export async function writePersistedOddsSnapshot(snapshot: PersistedOddsSnapshot) {
  if (!configured()) return false;
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/odds_snapshots?on_conflict=id`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ id: snapshotId, matches: snapshot.matches, fetched_at: snapshot.fetchedAt, expires_at: new Date(snapshot.expiresAt).toISOString() }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
