import type { Match } from "@/lib/types";
import { summarizeHealth, type ProviderHealth } from "@/lib/odds/marketSafety";

let health: ProviderHealth = {
  provider: "the-odds-api",
  status: "unconfigured",
  configured: false,
  bookmakerEvents: 0,
  modelEvents: 0,
  staleOrSuspendedEvents: 0,
};

let lastMatches: Match[] = [];

export function updateOddsHealth(patch: Partial<ProviderHealth>) {
  health = { ...health, ...patch };
}

export function recordOddsHealth(matches: Match[], now: number, pregameMaxAgeMs: number, liveMaxAgeMs: number) {
  lastMatches = matches;
  health = summarizeHealth(health, matches, now, pregameMaxAgeMs, liveMaxAgeMs);
}

export function getOddsHealth(now: number, pregameMaxAgeMs: number, liveMaxAgeMs: number) {
  health = summarizeHealth(health, lastMatches, now, pregameMaxAgeMs, liveMaxAgeMs);
  return health;
}
