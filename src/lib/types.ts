export type SportKey =
  | "soccer"
  | "nba"
  | "nfl"
  | "mlb"
  | "nhl"
  | "mma"
  | "tennis"
  | "formula1"
  | "boxing";

export type MarketType = "moneyline" | "total" | "handicap";

export type Match = {
  id: string;
  sport: SportKey;
  league: string;
  country: string;
  home: string;
  away: string;
  startsAt: string;
  status: "live" | "upcoming" | "finished" | "postponed";
  minute?: string;
  score?: string;
  odds?: {
    moneyline: { home: number; draw?: number; away: number };
    total?: { line: number; over: number; under: number };
    handicap?: { line: number; home: number; away: number };
  };
  oddsSource?: "real-provider" | "model-provider" | "calculated-demo";
  oddsUpdatedAt?: string;
  oddsProvider?: string;
  liveStats?: {
    source: "licensed-feed" | "model-estimate";
    possession: { home: number; away: number };
    xg: { home: number; away: number };
    shots: { home: number; away: number };
    shotsOnTarget: { home: number; away: number };
    dangerousAttacks: { home: number; away: number };
    corners: { home: number; away: number };
    momentum: { home: number; away: number };
    heatmap: { home: number[]; away: number[] };
  };
  model?: {
    version: string;
    confidence: number;
    dataQuality: number;
    margin: number;
    signals: string[];
    feedStatus?: Record<string, "active" | "missing" | "error">;
    calibration?: { closingLineScore: number; sampleSize: number };
  };
  risk?: {
    maxStake: number;
    exposureTier: "low" | "medium" | "high";
    reviewRequired: boolean;
    reasons: string[];
  };
  trader?: {
    controlled: boolean;
    suspended?: boolean;
    note?: string;
  };
  source: "espn-public" | "odds-api" | "henriquinho-model";
};

export type BetPick = {
  id: string;
  matchId: string;
  label: string;
  market: MarketType;
  odds: number;
  event: string;
  maxStake?: number;
};

export type Bet = {
  id: string;
  picks: BetPick[];
  stake: number;
  potentialWin: number;
  cashOut?: number;
  status: "open" | "won" | "lost" | "cashed_out";
  createdAt: string;
};

export type Transaction = {
  id: string;
  type: "signup_bonus" | "daily_bonus" | "deposit" | "bet_stake" | "bet_win" | "bet_cashout" | "casino_win" | "casino_loss";
  amount: number;
  label: string;
  createdAt: string;
  balanceAfter: number;
};

export type Player = {
  id: string;
  name: string;
  balance: number;
  winRate: number;
  favorite: string;
};
