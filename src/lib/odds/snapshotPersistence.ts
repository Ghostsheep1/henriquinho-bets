import type { Match } from "@/lib/types";

export type PersistedOddsSnapshot = {
  matches: Match[];
  expiresAt: number;
  fetchedAt: string;
};

const snapshotId = "pregame-bookmaker";
export async function readPersistedOddsSnapshot(): Promise<PersistedOddsSnapshot | null> {
  // A future protected Edge Function may persist snapshots. This public-key app
  // deliberately never bypasses RLS to read or write them.
  void snapshotId;
  return null;
}

export async function writePersistedOddsSnapshot(snapshot: PersistedOddsSnapshot) {
  void snapshot;
  return false;
}
