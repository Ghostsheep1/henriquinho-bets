import type { Transaction } from "./types";

export const featuredLeagues = [
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Champions League",
  "Copa Libertadores",
  "Brazilian Serie A",
  "MLS",
  "NBA",
  "NFL",
  "MLB",
  "NHL",
  "UFC/MMA",
  "Tennis",
  "Formula 1",
  "Boxing",
];

export const starterTransactions: Transaction[] = [
  { id: "t1", type: "signup_bonus", amount: 1000, label: "Welcome bonus", createdAt: "2026-06-12T18:00:00.000Z", balanceAfter: 1000 },
];
