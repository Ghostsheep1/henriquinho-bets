import assert from "node:assert/strict";
import test from "node:test";
import { dedupeProviderEvents, isMarketBettable, isRecordedPriceCurrent, marketFreshnessReason, payoutFromRecordedPrices, providerEventKey, validateSlipAtPlacement } from "../src/lib/odds/marketSafety";
import { requestProviderJson } from "../src/lib/odds/providerClient";
import type { BetPick, Match } from "../src/lib/types";

const now = Date.parse("2026-07-13T12:00:00.000Z");

function market(overrides: Partial<Match> = {}): Match {
  return {
    id: "bookmaker-the-odds-api-event-1",
    sport: "soccer",
    league: "Premier League",
    country: "England",
    home: "Home FC",
    away: "Away FC",
    startsAt: "2026-07-13T13:00:00.000Z",
    status: "upcoming",
    marketSource: "bookmaker",
    marketStatus: "open",
    provider: "the-odds-api",
    providerEventId: "event-1",
    providerLastUpdated: "2026-07-13T11:59:30.000Z",
    fetchedAt: "2026-07-13T11:59:40.000Z",
    oddsSource: "real-provider",
    source: "odds-api",
    odds: { moneyline: { home: 2.1, draw: 3.2, away: 3.6 }, total: { line: 2.5, over: 1.91, under: 1.91 } },
    ...overrides,
  };
}

function homePick(value = 2.1): BetPick {
  return { id: "event-1-home", matchId: "bookmaker-the-odds-api-event-1", label: "Home FC", market: "moneyline", odds: value, recordedPrice: value, event: "Home FC vs Away FC", source: "bookmaker", provider: "the-odds-api", providerEventId: "event-1" };
}

test("accepts a successful bookmaker response and captures quota headers", async () => {
  const result = await requestProviderJson<{ ok: boolean }>("https://provider.test/odds", {
    timeoutMs: 100,
    maxRetries: 0,
    fetcher: async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "x-requests-remaining": "492", "x-requests-used": "8", "x-requests-last": "3" } }),
  });
  assert.deepEqual(result.data, { ok: true });
  assert.equal(result.quota.remainingCredits, 492);
  assert.equal(result.quota.lastRequestCost, 3);
});

test("times out a provider request", async () => {
  const result = await requestProviderJson("https://provider.test/slow", {
    timeoutMs: 10,
    maxRetries: 0,
    fetcher: (_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }),
  });
  assert.equal(result.error, "Provider request timed out");
});

test("rejects invalid provider JSON", async () => {
  const result = await requestProviderJson("https://provider.test/bad-json", {
    timeoutMs: 100,
    maxRetries: 0,
    fetcher: async () => new Response("not-json", { status: 200 }),
  });
  assert.equal(result.error, "Provider returned invalid JSON");
});

test("retries a rate-limited request with a successful follow-up", async () => {
  let calls = 0;
  const result = await requestProviderJson<{ ok: boolean }>("https://provider.test/rate-limit", {
    timeoutMs: 100,
    maxRetries: 1,
    fetcher: async () => {
      calls += 1;
      return calls === 1
        ? new Response("too many", { status: 429, headers: { "retry-after": "0" } })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.data, { ok: true });
});

test("marks exhausted provider quota without retrying", async () => {
  const result = await requestProviderJson("https://provider.test/quota", {
    timeoutMs: 100,
    maxRetries: 2,
    fetcher: async () => new Response("OUT_OF_USAGE_CREDITS", { status: 401 }),
  });
  assert.equal(result.exhausted, true);
  assert.equal(result.status, 401);
});

test("suspends stale provider odds and ended events", () => {
  const stale = market({ providerLastUpdated: "2026-07-13T11:40:00.000Z" });
  assert.equal(marketFreshnessReason(stale, now, 15 * 60_000, 90_000), "stale provider price");
  assert.equal(isMarketBettable(market({ status: "finished" }), now, 15 * 60_000, 90_000), false);
});

test("deduplicates provider IDs while keeping a changed start time", () => {
  const events = dedupeProviderEvents([
    { id: "event-1", commence_time: "2026-07-13T13:00:00Z" },
    { id: "event-1", commence_time: "2026-07-13T14:00:00Z" },
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].commence_time, "2026-07-13T14:00:00Z");
  assert.equal(providerEventKey("the-odds-api", "event-1"), "the-odds-api:event-1");
});

test("keeps model fallback virtual and makes disabled fallback suspended", () => {
  const virtual = market({ marketSource: "henriquinho-model", provider: "henriquinho-model", oddsSource: "model-provider", source: "henriquinho-model" });
  const disabled = market({ marketStatus: "suspended", suspensionReason: "Bookmaker odds unavailable and model fallback is disabled", odds: undefined });
  assert.equal(virtual.marketSource, "henriquinho-model");
  assert.equal(isMarketBettable(virtual, now, 15 * 60_000, 90_000), true);
  assert.equal(isMarketBettable(disabled, now, 15 * 60_000, 90_000), false);
});

test("rejects changed prices and suspended markets at placement", () => {
  const pick = homePick();
  const changed = market({ odds: { moneyline: { home: 2.25, away: 3.6 } } });
  assert.equal(isRecordedPriceCurrent(pick, changed), false);
  assert.equal(validateSlipAtPlacement([pick], new Map([[changed.id, changed]]), now, 15 * 60_000, 90_000), false);
  const suspended = market({ marketStatus: "suspended", suspensionReason: "Provider refresh failed" });
  assert.equal(validateSlipAtPlacement([pick], new Map([[suspended.id, suspended]]), now, 15 * 60_000, 90_000), false);
});

test("settlement value is calculated from the recorded price, not a later market price", () => {
  const pick = homePick(2.1);
  const laterMarket = market({ odds: { moneyline: { home: 8.5, away: 1.2 } } });
  assert.equal(isRecordedPriceCurrent(pick, laterMarket), false);
  assert.equal(payoutFromRecordedPrices(25, [pick]), 53);
});
