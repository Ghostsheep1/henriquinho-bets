import type { BetPick, Match } from "@/lib/types";

export type FallbackMode = "disable" | "model";
export type PregameSnapshotRequest = { sport: string; regions: string; markets: string; oddsFormat: string };

export type ProviderHealthStatus = "unconfigured" | "healthy" | "degraded" | "rate_limited" | "quota_exhausted" | "error";

export type ProviderHealth = {
  provider: string;
  status: ProviderHealthStatus;
  configured: boolean;
  remainingCredits?: number;
  usedCredits?: number;
  lastRequestCost?: number;
  lastSuccessfulRequestAt?: string;
  lastError?: string;
  blockedUntil?: string;
  cacheAgeMs?: number;
  bookmakerEvents: number;
  modelEvents: number;
  staleOrSuspendedEvents: number;
  operationMode?: "model-only" | "pregame-snapshot" | "bookmaker-only" | "continuous";
  dailyRequestsUsed?: number;
  dailyRequestLimit?: number;
  monthlyCreditReserve?: number;
  nextScheduledSyncAt?: string;
};

export function isDecimalPrice(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 1;
}

export function isPregameSnapshotRequest(request: PregameSnapshotRequest) {
  return request.sport === "upcoming" && request.regions === "us" && request.markets === "h2h" && request.oddsFormat === "decimal";
}

export function snapshotRefreshBlockReason(input: { refreshInFlight: boolean; dailyRequests: number; dailyLimit: number; remainingCredits?: number; reserveCredits: number; exhausted?: boolean }) {
  if (input.refreshInFlight) return "A snapshot refresh is already running";
  if (input.exhausted) return "Provider quota is exhausted";
  if (input.dailyRequests >= input.dailyLimit) return "Daily bookmaker request limit reached";
  if (input.remainingCredits !== undefined && input.remainingCredits <= input.reserveCredits) return "Provider credit reserve reached";
  return null;
}

export function providerEventKey(provider: string, providerEventId: string) {
  return `${provider}:${providerEventId}`.toLowerCase();
}

export function dedupeProviderEvents<T extends { id: string }>(events: T[]) {
  return Array.from(new Map(events.map((event) => [event.id, event])).values());
}

export function marketFreshnessReason(match: Match, now: number, pregameMaxAgeMs: number, liveMaxAgeMs: number) {
  if (!match.odds || match.marketStatus !== "open") return match.suspensionReason ?? "market unavailable";
  if (match.status === "finished" || match.status === "postponed") return "event closed";
  if (match.marketMode === "pregame-snapshot") {
    const startsAt = new Date(match.startsAt).getTime();
    if (!Number.isFinite(startsAt) || startsAt <= now) return "event has started";
    const cutoffAt = new Date(match.marketCutoffAt ?? startsAt - 10 * 60_000).getTime();
    if (!Number.isFinite(cutoffAt) || now >= cutoffAt) return "pregame cutoff reached";
    const fetchedAt = new Date(match.fetchedAt ?? "").getTime();
    if (!Number.isFinite(fetchedAt)) return "missing snapshot timestamp";
    const expiresAt = new Date(match.marketExpiresAt ?? fetchedAt + 135 * 60_000).getTime();
    if (!Number.isFinite(expiresAt) || now >= expiresAt) return "bookmaker snapshot expired";
  }
  const updatedAt = new Date(match.providerLastUpdated ?? match.oddsUpdatedAt ?? match.fetchedAt ?? "").getTime();
  if (!Number.isFinite(updatedAt)) return "missing provider timestamp";
  const maxAge = match.status === "live" ? liveMaxAgeMs : pregameMaxAgeMs;
  if (now - updatedAt > maxAge) return "stale provider price";
  return null;
}

export function isMarketBettable(match: Match, now: number, pregameMaxAgeMs: number, liveMaxAgeMs: number) {
  return !marketFreshnessReason(match, now, pregameMaxAgeMs, liveMaxAgeMs);
}

export function priceForPick(pick: BetPick, match: Match): number | null {
  if (!match.odds) return null;
  if (pick.market === "moneyline") {
    if (pick.label === match.home) return match.odds.moneyline.home;
    if (pick.label === match.away) return match.odds.moneyline.away;
    if (pick.label === "Draw") return match.odds.moneyline.draw ?? null;
  }
  if (pick.market === "total" && match.odds.total) {
    return pick.label.startsWith("Over") ? match.odds.total.over : pick.label.startsWith("Under") ? match.odds.total.under : null;
  }
  if (pick.market === "handicap" && match.odds.handicap) {
    return pick.label.startsWith(match.home) ? match.odds.handicap.home : pick.label.startsWith(match.away) ? match.odds.handicap.away : null;
  }
  return null;
}

export function isRecordedPriceCurrent(pick: BetPick, match: Match) {
  const recorded = pick.recordedPrice ?? pick.odds;
  const current = priceForPick(pick, match);
  return isDecimalPrice(recorded) && current === recorded;
}

export function validateSlipAtPlacement(picks: BetPick[], matches: Map<string, Match>, now: number, pregameMaxAgeMs: number, liveMaxAgeMs: number) {
  for (const pick of picks) {
    const match = matches.get(pick.matchId);
    if (!match || !isMarketBettable(match, now, pregameMaxAgeMs, liveMaxAgeMs)) return false;
    if (!isRecordedPriceCurrent(pick, match)) return false;
  }
  return true;
}

export function payoutFromRecordedPrices(stake: number, picks: BetPick[]) {
  if (!Number.isFinite(stake) || stake <= 0 || !picks.length) return 0;
  const combined = picks.reduce((total, pick) => total * (pick.recordedPrice ?? pick.odds), 1);
  return Number.isFinite(combined) ? Math.round(stake * combined) : 0;
}

export function shouldRetryProvider(status: number | undefined, attempt: number, maxRetries: number) {
  return attempt < maxRetries && Boolean(status && (status === 429 || status >= 500));
}

export function retryDelayMs(attempt: number, retryAfterSeconds?: number) {
  if (retryAfterSeconds && retryAfterSeconds > 0) return Math.min(retryAfterSeconds * 1000, 30_000);
  return Math.min(1_000 * 2 ** attempt, 30_000);
}

export function summarizeHealth(health: Omit<ProviderHealth, "bookmakerEvents" | "modelEvents" | "staleOrSuspendedEvents">, matches: Match[], now: number, pregameMaxAgeMs: number, liveMaxAgeMs: number): ProviderHealth {
  return {
    ...health,
    bookmakerEvents: matches.filter((match) => match.marketSource === "bookmaker").length,
    modelEvents: matches.filter((match) => match.marketSource === "henriquinho-model").length,
    staleOrSuspendedEvents: matches.filter((match) => !isMarketBettable(match, now, pregameMaxAgeMs, liveMaxAgeMs)).length,
  };
}
