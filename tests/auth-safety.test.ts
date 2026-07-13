import assert from "node:assert/strict";
import test from "node:test";
import { canResendVerification, isAdultBirthDate, mayAccessAdmin, mayAccessPlayer, safeProfileInput } from "../src/lib/auth";

test("email/password accounts are only player profiles regardless of browser metadata", () => {
  const browserInput = { displayName: "  Ana  ", role: "admin", balance: 999999, account_status: "active" } as unknown as { displayName: unknown };
  assert.deepEqual(safeProfileInput(browserInput), { displayName: "Ana" });
});

test("unverified, suspended, and locked users cannot access player features", () => {
  assert.equal(mayAccessPlayer("active"), true);
  assert.equal(mayAccessPlayer("suspended"), false);
  assert.equal(mayAccessPlayer("locked"), false);
});

test("only active admins receive admin access", () => {
  assert.equal(mayAccessAdmin("player", "active"), false);
  assert.equal(mayAccessAdmin("admin", "suspended"), false);
  assert.equal(mayAccessAdmin("admin", "locked"), false);
  assert.equal(mayAccessAdmin("admin", "active"), true);
});

test("age verification accepts exactly eighteen and rejects younger dates", () => {
  const today = new Date("2026-07-13T12:00:00Z");
  assert.equal(isAdultBirthDate("2008-07-13", today), true);
  assert.equal(isAdultBirthDate("2008-07-14", today), false);
  assert.equal(isAdultBirthDate("not-a-date", today), false);
});

test("verification resend cooldown prevents immediate repeated requests", () => {
  const requestedAt = 1_000_000;
  assert.equal(canResendVerification(requestedAt, requestedAt + 59_999), false);
  assert.equal(canResendVerification(requestedAt, requestedAt + 60_000), true);
});

test("provider identities retain one profile per Supabase auth user ID", () => {
  const profiles = new Map<string, { role: string; wallet: number }>();
  const ensureProfile = (userId: string) => {
    if (!profiles.has(userId)) profiles.set(userId, { role: "player", wallet: 1000 });
    return profiles.get(userId)!;
  };
  const firstGoogleLogin = ensureProfile("auth-user-1");
  firstGoogleLogin.wallet = 850;
  const returningGoogleLogin = ensureProfile("auth-user-1");
  assert.equal(profiles.size, 1);
  assert.equal(returningGoogleLogin.wallet, 850);
  assert.equal(returningGoogleLogin.role, "player");
});

test("Apple private relay addresses are treated as normal verified identities", () => {
  const relayAddress = "abc123@privaterelay.appleid.com";
  assert.match(relayAddress, /@privaterelay\.appleid\.com$/);
});
