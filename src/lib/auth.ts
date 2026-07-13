export type AccountStatus = "active" | "suspended" | "locked";
export type AppRole = "player" | "admin";

export function isVerifiedUser(user: { email_confirmed_at?: string | null; app_metadata?: Record<string, unknown> }) {
  return Boolean(user.email_confirmed_at);
}

export function mayAccessPlayer(status: AccountStatus) {
  return status === "active";
}

export function mayAccessAdmin(role: AppRole, status: AccountStatus) {
  return role === "admin" && status === "active";
}

export function safeProfileInput(input: { displayName?: unknown }) {
  const displayName = typeof input.displayName === "string" ? input.displayName.trim().slice(0, 80) : "";
  return { displayName };
}

export function isAdultBirthDate(value: string, today = new Date()) {
  const birthDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > today) return false;
  const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return birthDate <= cutoff;
}

export function canResendVerification(lastRequestedAt: number, now = Date.now(), cooldownMs = 60_000) {
  return now - lastRequestedAt >= cooldownMs;
}
