"use client";

import {
  Activity,
  BarChart3,
  Crown,
  Gamepad2,
  Goal,
  LogIn,
  Menu,
  Sparkles,
  Trophy,
  User,
  Wallet,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { featuredLeagues, starterTransactions } from "@/lib/seed";
import type { Bet, BetPick, Match, SportKey, Transaction } from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
});

const sportLabels: Record<SportKey | "all", string> = {
  all: "All",
  soccer: "Soccer",
  nba: "NBA",
  nfl: "NFL",
  mlb: "MLB",
  nhl: "NHL",
  mma: "UFC/MMA",
  tennis: "Tennis",
  formula1: "Formula 1",
  boxing: "Boxing",
};

const nav = [
  { id: "sports", label: "Sportsbook", icon: Goal },
  { id: "live", label: "In-play", icon: Activity },
  { id: "casino", label: "Casino", icon: Gamepad2 },
  { id: "wallet", label: "Wallet", icon: Wallet },
  { id: "profile", label: "Profile", icon: User },
  { id: "admin", label: "Admin", icon: BarChart3 },
];

type AppUser = { name: string; email: string };

const initialUser: AppUser = { name: "Henrique", email: "henrique@example.com" };

type SportsPayload = {
  configured: boolean;
  matches: Match[];
  worldCup?: Match[];
  message: string;
};

const casinoCategories = ["All", "Blaze Games", "Slots", "Table Games", "Live", "Map Games", "Sports Arcade", "Instant Win"] as const;

const casinoGames = [
  ["Crash", "Blaze Games"], ["Double", "Blaze Games"], ["Mines", "Blaze Games"], ["Plinko", "Blaze Games"], ["Dice", "Blaze Games"],
  ["Limbo", "Blaze Games"], ["HiLo", "Blaze Games"], ["Coin Flip", "Blaze Games"], ["Wheel", "Blaze Games"], ["Tower", "Blaze Games"],
  ["European Roulette", "Table Games"], ["American Roulette", "Table Games"], ["Blackjack", "Table Games"], ["Baccarat", "Table Games"],
  ["Texas Hold'em Poker", "Table Games"], ["Video Poker", "Table Games"], ["Three Card Poker", "Table Games"], ["Dragon Tiger", "Table Games"],
  ["Sic Bo", "Table Games"], ["Keno", "Table Games"], ["Pai Gow Poker", "Table Games"],
  ["Classic Fruit Slots", "Slots"], ["Book of Pharaohs", "Slots"], ["Space Reels", "Slots"], ["Soccer Stars", "Slots"], ["Carnival Cash", "Slots"],
  ["Mega Ways", "Slots"], ["Progressive Crown", "Slots"], ["Aztec Gold", "Slots"], ["Viking Raid", "Slots"], ["Pirate Bay", "Slots"],
  ["Drop the Pin", "Map Games"], ["City Roulette", "Map Games"], ["Distance Bet", "Map Games"],
  ["Penalty Shootout", "Sports Arcade"], ["Free Kick", "Sports Arcade"], ["Basketball Shots", "Sports Arcade"], ["Horse Racing", "Sports Arcade"],
  ["Greyhound Racing", "Sports Arcade"], ["Quick Soccer", "Sports Arcade"], ["F1 Sprint", "Sports Arcade"],
  ["Scratch Gold", "Instant Win"], ["Scratch Gems", "Instant Win"], ["Scratch Goals", "Instant Win"], ["Scratch Carnival", "Instant Win"],
  ["Scratch Space", "Instant Win"], ["Instant Keno", "Instant Win"], ["Pick 3", "Instant Win"], ["Pick 4", "Instant Win"],
  ["Bingo 75", "Instant Win"], ["Bingo 90", "Instant Win"], ["Instant Win Wheel", "Instant Win"],
  ...Array.from({ length: 58 }, (_, index) => [`Crown ${index + 1}`, index % 2 ? "Live" : "Slots"]),
] as Array<[string, (typeof casinoCategories)[number]]>;

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function payout(stake: number, odds: number) {
  return Math.round(stake * odds);
}

function parseScore(score?: string) {
  const [home, away] = score?.split("-").map((part) => Number(part.trim())) ?? [];
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  return { home, away, total: home + away };
}

function settlePicksFromMatches(picks: BetPick[], matchById: Map<string, Match>) {
  let ready = true;
  let won = true;

  for (const pick of picks) {
    const match = matchById.get(pick.matchId);
    const score = parseScore(match?.score);
    if (!match || match.status !== "finished" || !score) {
      ready = false;
      continue;
    }

    if (pick.market === "moneyline") {
      const winner = score.home > score.away ? match.home : score.away > score.home ? match.away : "Draw";
      won = won && pick.label === winner;
    }

    if (pick.market === "total") {
      const line = Number(pick.label.replace(/[^0-9.]/g, ""));
      won = won && (pick.label.startsWith("Over") ? score.total > line : score.total < line);
    }

    if (pick.market === "handicap") {
      const homePick = pick.label.startsWith(match.home);
      const line = Number(pick.label.replace(homePick ? match.home : match.away, "").trim());
      const adjusted = homePick ? score.home + line - score.away : score.away + line - score.home;
      won = won && adjusted > 0;
    }
  }

  return { ready, won };
}

function useLiveSports() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [worldCup, setWorldCup] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading markets");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [oddsResponse, footballResponse] = await Promise.all([fetch("/api/odds"), fetch("/api/football")]);
        const odds = (await oddsResponse.json()) as SportsPayload;
        const football = (await footballResponse.json()) as SportsPayload;
        const byId = new Map<string, Match>();

        for (const match of [...(football.matches ?? []), ...(odds.matches ?? [])]) {
          const existing = byId.get(match.id);
          byId.set(match.id, existing ? { ...existing, ...match, odds: match.odds ?? existing.odds } : match);
        }

        if (!active) return;
        setMatches(Array.from(byId.values()).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
        setWorldCup(football.worldCup ?? []);
        setMessage(!odds.configured || !football.configured ? "Odds updating soon" : odds.message === "ok" || football.message === "ok" ? "Live markets loaded" : "Odds updating soon");
      } catch {
        if (!active) return;
        setMatches([]);
        setWorldCup([]);
        setMessage("Odds updating soon");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(load, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return { matches, worldCup, loading, message };
}

export default function HenriquinhoApp() {
  const [active, setActive] = useState("sports");
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AppUser | null>(initialUser);
  const [balance, setBalance] = useState(1000);
  const [transactions, setTransactions] = useState<Transaction[]>(starterTransactions);
  const [bets, setBets] = useState<Bet[]>([]);
  const [slip, setSlip] = useState<BetPick[]>([]);
  const [stake, setStake] = useState(25);
  const [lastBonus, setLastBonus] = useState<string | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const { matches, worldCup, loading, message } = useLiveSports();
  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);

  useEffect(() => {
    const raw = localStorage.getItem("henriquinho-state-v2");
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      user: AppUser | null;
      balance: number;
      transactions: Transaction[];
      bets: Bet[];
      lastBonus: string | null;
    };
    setUser(parsed.user);
    setBalance(parsed.balance);
    setTransactions((parsed.transactions ?? starterTransactions).map((transaction) => ({
      ...transaction,
      balanceAfter: transaction.balanceAfter ?? parsed.balance ?? 1000,
    })));
    setBets(parsed.bets);
    setLastBonus(parsed.lastBonus);
  }, []);

  useEffect(() => {
    localStorage.setItem("henriquinho-state-v2", JSON.stringify({ user, balance, transactions, bets, lastBonus }));
  }, [user, balance, transactions, bets, lastBonus]);

  const addTransaction = (type: Transaction["type"], amount: number, label: string) => {
    setBalance((current) => {
      const next = current + amount;
      setTransactions((items) => [{ id: uid("txn"), type, amount, label, createdAt: new Date().toISOString(), balanceAfter: next }, ...items]);
      return next;
    });
  };

  const casinoResult = (game: string, amount: number) => {
    addTransaction(amount >= 0 ? "casino_win" : "casino_loss", amount, game);
  };

  const combinedOdds = slip.reduce((total, pick) => total * pick.odds, 1);
  const potentialWin = payout(stake, combinedOdds);

  const placeBet = () => {
    if (!slip.length || stake <= 0 || stake > balance) return;
    const bet: Bet = { id: uid("bet"), picks: slip, stake, potentialWin, status: "open", createdAt: new Date().toISOString() };
    setBets((items) => [bet, ...items]);
    addTransaction("bet_stake", -stake, `${slip.length > 1 ? "Parlay" : "Single"} bet placed`);
    setSlip([]);
  };

  const settleBet = (id: string) => {
    const payouts: Array<{ amount: number; label: string }> = [];
    setBets((items) =>
      items.map((bet) => {
        if (bet.id !== id || bet.status !== "open") return bet;
        const outcome = settlePicksFromMatches(bet.picks, matchById);
        if (!outcome.ready) return bet;
        const won = outcome.won;
        if (won) payouts.push({ amount: bet.potentialWin, label: "Bet settlement" });
        return { ...bet, status: won ? "won" : "lost" };
      }),
    );
    window.setTimeout(() => payouts.forEach((item) => addTransaction("bet_win", item.amount, item.label)), 0);
  };

  useEffect(() => {
    const payouts: Array<{ amount: number; label: string }> = [];
    setBets((items) =>
      items.map((bet) => {
        if (bet.status !== "open") return bet;
        const outcome = settlePicksFromMatches(bet.picks, matchById);
        if (!outcome.ready) return bet;
        if (outcome.won) payouts.push({ amount: bet.potentialWin, label: "Bet settlement" });
        return { ...bet, status: outcome.won ? "won" : "lost" };
      }),
    );
    payouts.forEach((item) => addTransaction("bet_win", item.amount, item.label));
  }, [matchById]);

  const claimBonus = () => {
    const today = new Date().toDateString();
    if (lastBonus === today) return;
    setLastBonus(today);
    addTransaction("daily_bonus", 50, "Daily bonus");
  };

  const completeDeposit = (amount: number) => {
    addTransaction("deposit", amount, `Deposit ${uid("HB").toUpperCase()}`);
  };

  const winCount = bets.filter((bet) => bet.status === "won").length;
  const lossCount = bets.filter((bet) => bet.status === "lost").length;

  return (
    <div className="min-h-screen bg-[#070a0c] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(12,159,89,0.22),_transparent_34%),linear-gradient(135deg,_#070a0c_0%,_#0d1712_45%,_#141006_100%)]" />
      <LiveTicker matches={matches} message={message} />
      <Header user={user} balance={balance} soundOn={soundOn} setSoundOn={setSoundOn} onMenu={() => setMenuOpen(true)} onDeposit={() => setDepositOpen(true)} />
      <div className="mx-auto flex max-w-[1540px] gap-4 px-3 pb-8 pt-3 sm:px-5">
        <Sidebar active={active} setActive={setActive} open={menuOpen} setOpen={setMenuOpen} />
        <main className="min-w-0 flex-1 space-y-4">
          <Hero setActive={setActive} />
          {active === "sports" && <Sportsbook matches={matches} worldCup={worldCup} loading={loading} message={message} slip={slip} setSlip={setSlip} />}
          {active === "live" && <Sportsbook liveOnly matches={matches} worldCup={worldCup} loading={loading} message={message} slip={slip} setSlip={setSlip} />}
          {active === "casino" && <Casino balance={balance} soundOn={soundOn} onResult={casinoResult} />}
          {active === "wallet" && <WalletView balance={balance} claimBonus={claimBonus} transactions={transactions} onDeposit={() => setDepositOpen(true)} />}
          {active === "profile" && <ProfileView user={user} setUser={setUser} balance={balance} bets={bets} winCount={winCount} lossCount={lossCount} />}
          {active === "admin" && <AdminView bets={bets} transactions={transactions} />}
        </main>
        <aside className="hidden w-80 shrink-0 space-y-4 xl:block">
          <BetSlip slip={slip} setSlip={setSlip} stake={stake} setStake={setStake} balance={balance} placeBet={placeBet} combinedOdds={combinedOdds} potentialWin={potentialWin} />
          <Leaderboard user={user} balance={balance} />
          <BetHistory bets={bets} settleBet={settleBet} />
        </aside>
      </div>
      <div className="sticky bottom-0 z-30 border-t border-white/10 bg-[#08100d]/95 p-3 backdrop-blur xl:hidden">
        <BetSlip compact slip={slip} setSlip={setSlip} stake={stake} setStake={setStake} balance={balance} placeBet={placeBet} combinedOdds={combinedOdds} potentialWin={potentialWin} />
      </div>
      <Footer />
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} onComplete={completeDeposit} />
    </div>
  );
}

function Header({ user, balance, soundOn, setSoundOn, onMenu, onDeposit }: { user: AppUser | null; balance: number; soundOn: boolean; setSoundOn: (value: boolean) => void; onMenu: () => void; onDeposit: () => void }) {
  return (
    <header className="sticky top-8 z-30 border-b border-white/10 bg-[#080d0b]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-3 px-3 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <button className="rounded-md border border-white/10 p-2 lg:hidden" onClick={onMenu} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500 text-black shadow-[0_0_30px_rgba(16,185,129,0.35)]">
            <Crown className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-black tracking-wide text-white">Henriquinho<span className="text-amber-300">Bets</span></div>
            <div className="hidden text-xs text-slate-400 sm:block">Sports betting & casino</div>
          </div>
        </div>
        <div className="hidden min-w-0 flex-1 items-center justify-center md:flex" />
        <div className="flex items-center gap-2">
          <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-right">
            <div className="text-[10px] uppercase text-amber-200">Balance</div>
            <div className="font-black text-amber-100">{currency.format(balance)}</div>
          </div>
          <button onClick={onDeposit} className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-black text-black">Deposit</button>
          <button onClick={() => setSoundOn(!soundOn)} className="rounded-md border border-white/10 bg-white/5 p-2" aria-label="Toggle sound">
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <div className="hidden rounded-md border border-white/10 bg-white/5 px-3 py-2 sm:block">
            <div className="text-xs text-slate-400">{user ? user.name : "Guest"}</div>
            <div className="text-sm font-semibold text-white">{user ? "Signed in" : "Sign in"}</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function LiveTicker({ matches, message }: { matches: Match[]; message: string }) {
  return (
    <div className="sticky top-0 z-40 overflow-hidden border-b border-emerald-300/20 bg-[#040706] py-2 text-xs">
      <div className="animate-marquee whitespace-nowrap text-slate-300">
        {matches.length === 0 && <span className="mx-6 text-amber-200">{message}</span>}
        {matches.slice(0, 24).map((match) => (
          <span key={match.id} className="mx-6">
            <span className="text-emerald-300">{match.status === "live" ? "LIVE" : match.league}</span> {match.home} vs {match.away}{" "}
            <span className="text-amber-200">{match.score ?? (match.odds ? `${match.odds.moneyline.home}/${match.odds.moneyline.away}` : dateTime.format(new Date(match.startsAt)))}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Sidebar({ active, setActive, open, setOpen }: { active: string; setActive: (id: string) => void; open: boolean; setOpen: (open: boolean) => void }) {
  return (
    <>
      <div className={clsx("fixed inset-0 z-40 bg-black/70 lg:hidden", open ? "block" : "hidden")} onClick={() => setOpen(false)} />
      <aside className={clsx("fixed left-0 top-0 z-50 h-full w-72 border-r border-white/10 bg-[#08100d] p-4 transition lg:sticky lg:top-24 lg:z-10 lg:h-[calc(100vh-7rem)] lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <span className="font-bold">Menu</span>
          <button onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-2">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActive(item.id);
                  setOpen(false);
                }}
                className={clsx("flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold transition", active === item.id ? "bg-emerald-500 text-black" : "text-slate-300 hover:bg-white/10 hover:text-white")}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-5 rounded-md border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-50">
          <Crown className="mb-2 h-5 w-5 text-amber-300" />
          Licensed & Regulated badge active. API markets refresh every 60 seconds.
        </div>
      </aside>
    </>
  );
}

function Hero({ setActive }: { setActive: (id: string) => void }) {
  return (
    <section className="overflow-hidden rounded-md border border-white/10 bg-[linear-gradient(120deg,_rgba(6,95,70,.65),_rgba(21,16,5,.82)),url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center p-5 shadow-2xl sm:p-7">
      <div className="max-w-3xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-black/45 px-3 py-2 text-xs font-bold uppercase text-amber-200">
          <Sparkles className="h-4 w-4" /> live odds, casino games, premium markets
        </div>
        <h1 className="text-4xl font-black text-white sm:text-6xl">HenriquinhoBets</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-200 sm:text-lg">
          Sports betting, casino games, live markets, wallet history, leaderboard, and account analytics in one polished dark trading floor.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-md bg-emerald-400 px-4 py-3 font-black text-black" onClick={() => setActive("sports")}>Browse odds</button>
          <button className="rounded-md border border-amber-200/50 bg-black/35 px-4 py-3 font-black text-amber-100" onClick={() => setActive("casino")}>Play casino</button>
        </div>
      </div>
    </section>
  );
}

function Sportsbook({ liveOnly, matches, worldCup, loading, message, slip, setSlip }: { liveOnly?: boolean; matches: Match[]; worldCup: Match[]; loading: boolean; message: string; slip: BetPick[]; setSlip: React.Dispatch<React.SetStateAction<BetPick[]>> }) {
  const [sport, setSport] = useState<SportKey | "all">("all");
  const [league, setLeague] = useState("All leagues");
  const filteredMatches = useMemo(
    () => matches.filter((match) => (sport === "all" || match.sport === sport) && (league === "All leagues" || match.league === league) && (!liveOnly || match.status === "live")),
    [league, liveOnly, matches, sport],
  );
  const addPick = (pick: BetPick) => {
    setSlip((items) => (items.some((item) => item.id === pick.id) ? items.filter((item) => item.id !== pick.id) : [...items.filter((item) => item.matchId !== pick.matchId || item.market !== pick.market), pick]));
  };

  return (
    <section className="space-y-4">
      <WorldCupPanel matches={worldCup} loading={loading} message={message} />
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(sportLabels) as Array<SportKey | "all">).map((key) => (
          <button key={key} onClick={() => setSport(key)} className={clsx("rounded-md border px-3 py-2 text-sm font-semibold", sport === key ? "border-emerald-300 bg-emerald-400 text-black" : "border-white/10 bg-white/5 text-slate-300")}>{sportLabels[key]}</button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-3">
          {loading && <SkeletonMarkets />}
          {!loading && filteredMatches.length === 0 && <EmptyMarkets message={message} />}
          {filteredMatches.map((match) => (
            <MatchCard key={match.id} match={match} addPick={addPick} slip={slip} />
          ))}
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <div className="mb-3 font-bold text-white">League coverage</div>
          <select value={league} onChange={(event) => setLeague(event.target.value)} className="mb-4 w-full rounded-md border border-white/10 bg-[#0b1511] px-3 py-2 text-sm">
            <option>All leagues</option>
            {featuredLeagues.map((item) => <option key={item}>{item}</option>)}
          </select>
          <div className="space-y-2 text-sm text-slate-300">
            {featuredLeagues.map((item) => (
              <div key={item} className="flex items-center justify-between rounded-md bg-black/20 px-3 py-2">
                <span>{item}</span>
                <span className="text-emerald-300">Live</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function WorldCupPanel({ matches, loading, message }: { matches: Match[]; loading: boolean; message: string }) {
  return (
    <section className="rounded-md border border-amber-300/20 bg-[linear-gradient(135deg,_rgba(5,150,105,.22),_rgba(251,191,36,.12))] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-amber-200">Featured Tournament</div>
          <h2 className="text-2xl font-black text-white">FIFA World Cup 2026</h2>
        </div>
        <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200">USA - Canada - Mexico</div>
      </div>
      {loading && <div className="mt-4 grid gap-3 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-md bg-white/10" />)}</div>}
      {!loading && matches.length === 0 && <div className="mt-4 rounded-md bg-black/25 p-4 text-sm text-amber-100">{message}. ESPN scoreboards are updating soon.</div>}
      {!loading && matches.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {matches.slice(0, 6).map((match) => (
            <div key={match.id} className="rounded-md bg-black/25 p-3">
              <div className="text-xs uppercase text-emerald-300">{match.status}</div>
              <div className="mt-1 font-black text-white">{match.home} vs {match.away}</div>
              <div className="text-sm text-slate-300">{match.score ?? dateTime.format(new Date(match.startsAt))}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SkeletonMarkets() {
  return (
    <>
      {[1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-md border border-white/10 bg-white/[0.05]" />)}
    </>
  );
}

function EmptyMarkets({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-amber-300/20 bg-[#0b1210] p-6 text-center">
      <div className="text-xl font-black text-white">{message}</div>
      <p className="mt-2 text-sm text-slate-400">Markets appear here as soon as ESPN scoreboards return scheduled or live events.</p>
    </div>
  );
}

function MatchCard({ match, addPick, slip }: { match: Match; addPick: (pick: BetPick) => void; slip: BetPick[] }) {
  const event = `${match.home} vs ${match.away}`;
  const picks: BetPick[] = match.odds ? [
    { id: `${match.id}-home`, matchId: match.id, label: match.home, market: "moneyline", odds: match.odds.moneyline.home, event },
    ...(match.odds.moneyline.draw ? [{ id: `${match.id}-draw`, matchId: match.id, label: "Draw", market: "moneyline" as const, odds: match.odds.moneyline.draw, event }] : []),
    { id: `${match.id}-away`, matchId: match.id, label: match.away, market: "moneyline", odds: match.odds.moneyline.away, event },
    ...(match.odds.total ? [
      { id: `${match.id}-over`, matchId: match.id, label: `Over ${match.odds.total.line}`, market: "total" as const, odds: match.odds.total.over, event },
      { id: `${match.id}-under`, matchId: match.id, label: `Under ${match.odds.total.line}`, market: "total" as const, odds: match.odds.total.under, event },
    ] : []),
    ...(match.odds.handicap ? [
      { id: `${match.id}-spread-home`, matchId: match.id, label: `${match.home} ${match.odds.handicap.line}`, market: "handicap" as const, odds: match.odds.handicap.home, event },
      { id: `${match.id}-spread-away`, matchId: match.id, label: `${match.away} ${-match.odds.handicap.line}`, market: "handicap" as const, odds: match.odds.handicap.away, event },
    ] : []),
  ] : [];
  return (
    <article className="rounded-md border border-white/10 bg-[#0b1210] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase text-slate-400">
            <span className={clsx("rounded px-2 py-1 font-bold", match.status === "live" ? "bg-red-500/20 text-red-200" : "bg-white/10")}>{match.status}</span>
            <span>{match.league}</span>
            <span>{match.country}</span>
          </div>
          <h3 className="mt-2 text-lg font-black text-white">{event}</h3>
          <p className="text-sm text-slate-400">{match.score ?? dateTime.format(new Date(match.startsAt))} {match.minute ? `- ${match.minute}` : ""}</p>
        </div>
        <div className="rounded-md bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-200">{match.odds ? "Realtime odds" : "Odds updating soon"}</div>
      </div>
      {picks.length === 0 && <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-sm text-amber-100">Odds updating soon</div>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {picks.map((pick) => {
          const selected = slip.some((item) => item.id === pick.id);
          return (
            <button key={pick.id} onClick={() => addPick(pick)} className={clsx("flex items-center justify-between rounded-md border px-3 py-3 text-left text-sm transition", selected ? "border-emerald-300 bg-emerald-400 text-black" : "border-white/10 bg-white/[0.04] hover:bg-white/10")}>
              <span className="truncate pr-2">{pick.label}</span>
              <span className="font-black">{compact.format(pick.odds)}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

function BetSlip({ compact: small, slip, setSlip, stake, setStake, balance, placeBet, combinedOdds, potentialWin }: { compact?: boolean; slip: BetPick[]; setSlip: React.Dispatch<React.SetStateAction<BetPick[]>>; stake: number; setStake: (stake: number) => void; balance: number; placeBet: () => void; combinedOdds: number; potentialWin: number }) {
  return (
    <div className="rounded-md border border-emerald-300/20 bg-[#0b1210] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-black text-white">Bet slip</h2>
        <span className="rounded bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">{slip.length} picks</span>
      </div>
      <div className={clsx("space-y-2", small && "max-h-28 overflow-auto")}>
        {slip.length === 0 && <p className="text-sm text-slate-400">Select odds to build a single, multi-bet, or parlay.</p>}
        {slip.map((pick) => (
          <div key={pick.id} className="rounded-md bg-white/[0.04] p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-white">{pick.label}</div>
                <div className="text-xs text-slate-400">{pick.event}</div>
              </div>
              <button onClick={() => setSlip((items) => items.filter((item) => item.id !== pick.id))} className="text-slate-400" aria-label="Remove pick"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-2 text-emerald-300">@ {compact.format(pick.odds)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs uppercase text-slate-400">
          Stake
          <input value={stake} onChange={(event) => setStake(Number(event.target.value))} min={1} max={balance} type="number" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-base text-white" />
        </label>
        <div className="rounded-md bg-amber-300/10 p-2">
          <div className="text-xs uppercase text-amber-200">Potential</div>
          <div className="font-black text-amber-100">{currency.format(potentialWin || 0)}</div>
        </div>
      </div>
      <button disabled={!slip.length || stake > balance} onClick={placeBet} className="mt-3 w-full rounded-md bg-emerald-400 px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
        Place bet {combinedOdds > 1 ? `@ ${compact.format(combinedOdds)}` : ""}
      </button>
    </div>
  );
}

function Casino({ balance, soundOn, onResult }: { balance: number; soundOn: boolean; onResult: (game: string, amount: number) => void }) {
  const [category, setCategory] = useState<(typeof casinoCategories)[number]>("All");
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const visibleGames = casinoGames.filter((game) => category === "All" || game[1] === category);
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {casinoCategories.map((item) => (
          <button key={item} onClick={() => setCategory(item)} className={clsx("rounded-md border px-3 py-2 text-sm font-bold", category === item ? "border-emerald-300 bg-emerald-400 text-black" : "border-white/10 bg-white/5 text-slate-300")}>{item}</button>
        ))}
      </div>
      <div className="rounded-md border border-white/10 bg-[#0b1210] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-black text-white">Game Lobby</h2>
          <span className="rounded bg-emerald-400/10 px-2 py-1 text-xs text-emerald-200">{visibleGames.length} games</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleGames.map(([name, group], index) => (
            <button key={`${name}-${index}`} onClick={() => setSelectedGame(name)} className="group overflow-hidden rounded-md border border-white/10 bg-[linear-gradient(145deg,_rgba(15,23,42,.8),_rgba(5,150,105,.18))] p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300/60">
              <div className="mb-4 flex h-20 items-center justify-center rounded-md bg-black/30 text-3xl font-black text-amber-200 group-hover:animate-pulse">{name.slice(0, 2).toUpperCase()}</div>
              <div className="font-black text-white">{name}</div>
              <div className="mt-1 text-xs uppercase text-emerald-300">{group}</div>
              <div className="mt-3 rounded bg-emerald-400 px-3 py-2 text-center text-xs font-black text-black">Play</div>
            </button>
          ))}
        </div>
      </div>
      <GameModal game={selectedGame} balance={balance} soundOn={soundOn} onClose={() => setSelectedGame(null)} onResult={onResult} />
    </section>
  );
}

function GameModal({ game, balance, soundOn, onClose, onResult }: { game: string | null; balance: number; soundOn: boolean; onClose: () => void; onResult: (game: string, amount: number) => void }) {
  if (!game) return null;
  const settle = (label: string, amount: number) => {
    playTone(soundOn, amount >= 0 ? 720 : 180);
    onResult(label, amount);
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/85 p-3 backdrop-blur sm:p-6">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-md border border-white/10 bg-[#07100d] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-xs uppercase text-emerald-300">Game</div>
            <h2 className="text-2xl font-black text-white">{game}</h2>
          </div>
          <button onClick={onClose} className="rounded-md border border-white/10 p-2" aria-label="Close game"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {renderGame(game, balance, settle)}
        </div>
      </div>
    </div>
  );
}

function playTone(enabled: boolean, frequency: number) {
  if (!enabled || typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.value = 0.04;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.12);
}

function renderGame(game: string, balance: number, settle: (label: string, amount: number) => void) {
  if (game === "Crash") return <CrashModalGame balance={balance} settle={settle} />;
  if (game === "Mines") return <MinesModalGame balance={balance} settle={settle} />;
  if (game === "Plinko") return <PlinkoModalGame balance={balance} settle={settle} />;
  if (game === "Dice") return <DiceModalGame balance={balance} settle={settle} />;
  if (game === "HiLo") return <HiLoModalGame balance={balance} settle={settle} />;
  if (game.includes("Roulette")) return <RouletteModalGame game={game} balance={balance} settle={settle} />;
  if (game === "Blackjack") return <BlackjackModalGame balance={balance} settle={settle} />;
  if (game.includes("Slots") || game.includes("Reels") || game.includes("Crown") || game.includes("Pharaoh") || game.includes("Gold") || game.includes("Pirate") || game.includes("Viking") || game.includes("Carnival")) return <SlotModalGame game={game} balance={balance} settle={settle} />;
  if (game === "Penalty Shootout" || game === "Free Kick" || game === "Basketball Shots") return <AimModalGame game={game} balance={balance} settle={settle} />;
  if (game === "Drop the Pin" || game === "City Roulette" || game === "Distance Bet") return <MapModalGame game={game} balance={balance} settle={settle} />;
  return <InstantModalGame game={game} balance={balance} settle={settle} />;
}

function ModalStake({ stake, setStake, disabled }: { stake: number; setStake: (stake: number) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-40 text-xs uppercase text-slate-400">
        Bet amount
        <input disabled={disabled} type="number" min={1} max={999999} value={stake} onChange={(event) => setStake(Number(event.target.value))} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3 text-base text-white" />
      </label>
      {[10, 25, 50, 100].map((value) => <button disabled={disabled} key={value} onClick={() => setStake(value)} className="rounded-md bg-white/10 px-3 py-3 text-sm font-bold disabled:opacity-40">{currency.format(value)}</button>)}
    </div>
  );
}

function ResultBanner({ result }: { result: string }) {
  if (!result) return null;
  const win = result.toLowerCase().includes("won") || result.includes("+");
  return <div className={clsx("mt-4 rounded-md px-4 py-3 font-black", win ? "animate-pulse bg-emerald-400 text-black" : "animate-shake bg-red-500/80 text-white")}>{result}</div>;
}

function CrashModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const [running, setRunning] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [multiplier, setMultiplier] = useState(1);
  const [crashAt, setCrashAt] = useState(2);
  const [history, setHistory] = useState([1.22, 3.48, 1.03, 6.12, 2.05, 9.4, 1.76]);
  const [result, setResult] = useState("");
  const settledRef = useRef(false);

  useEffect(() => {
    if (running) return;
    const timer = window.setInterval(() => setCountdown((value) => (value <= 1 ? 5 : value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setMultiplier((value) => {
        const next = Number((value * 1.045 + 0.01).toFixed(2));
        return next >= crashAt ? crashAt : next;
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [crashAt, running]);

  useEffect(() => {
    if (!running || settledRef.current || multiplier < crashAt) return;
    settledRef.current = true;
    setRunning(false);
    setHistory((items) => [crashAt, ...items].slice(0, 20));
    setResult(`Crashed at ${crashAt.toFixed(2)}x. Lost ${currency.format(stake)}.`);
    settle("Crash", -stake);
  }, [crashAt, multiplier, running, settle, stake]);

  const start = () => {
    settledRef.current = false;
    setResult("");
    setMultiplier(1);
    setCrashAt(Number((1.01 + Math.random() * 18.99).toFixed(2)));
    setRunning(true);
  };

  const cashOut = () => {
    if (!running) return;
    const profit = payout(stake, multiplier) - stake;
    settledRef.current = true;
    setRunning(false);
    setHistory((items) => [multiplier, ...items].slice(0, 20));
    setResult(`Cashed out at ${multiplier.toFixed(2)}x. Won +${currency.format(profit)}.`);
    settle("Crash cash out", profit);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-md border border-emerald-300/20 bg-black p-4 shadow-[0_0_50px_rgba(16,185,129,.15)]">
        <div className="mb-4 flex items-center justify-between">
          <ModalStake stake={stake} setStake={setStake} disabled={running} />
          <div className="text-sm text-amber-200">{running ? "Round live" : `Next round in ${countdown}...`}</div>
        </div>
        <div className="relative h-80 overflow-hidden rounded-md bg-[radial-gradient(circle_at_bottom_left,_rgba(16,185,129,.24),_transparent_55%)]">
          <svg viewBox="0 0 600 300" className="absolute inset-0 h-full w-full">
            <path d={`M 20 270 C 170 ${260 - multiplier * 18}, 310 ${245 - multiplier * 24}, ${Math.min(560, 60 + multiplier * 55)} ${Math.max(25, 270 - multiplier * 34)}`} fill="none" stroke="#34d399" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <div className="absolute text-4xl transition-all" style={{ left: `${Math.min(82, 8 + multiplier * 8)}%`, bottom: `${Math.min(78, 10 + multiplier * 7)}%` }}>🚀</div>
          <div className="absolute inset-0 flex items-center justify-center text-7xl font-black text-emerald-300">{multiplier.toFixed(2)}x</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button disabled={running || stake > balance} onClick={start} className="rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">Start Round</button>
          <button disabled={!running} onClick={cashOut} className="rounded-md bg-amber-300 py-3 font-black text-black disabled:opacity-40">Cash Out</button>
        </div>
        <ResultBanner result={result} />
      </div>
      <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
        <h3 className="font-black text-white">Crash History</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {history.map((item, index) => <span key={`${item}-${index}`} className={clsx("rounded px-2 py-1 text-xs font-black", item < 2 ? "bg-red-500/25 text-red-200" : "bg-emerald-400/20 text-emerald-200")}>{item.toFixed(2)}x</span>)}
        </div>
        <div className="mt-4 space-y-2 text-xs text-slate-300">
          {["Mika cashed 1.84x", "Rafa cashed 3.12x", "Lia waiting", "Andre cashed 2.44x"].map((line) => <div key={line} className="rounded bg-black/25 px-3 py-2">{line}</div>)}
        </div>
      </div>
    </div>
  );
}

function MinesModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const [mineCount, setMineCount] = useState(3);
  const [mines, setMines] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [active, setActive] = useState(false);
  const [result, setResult] = useState("");
  const multiplier = Number((1 + revealed.length * (mineCount / 18 + 0.18)).toFixed(2));
  const start = () => {
    const picks = new Set<number>();
    while (picks.size < mineCount) picks.add(Math.floor(Math.random() * 25));
    setMines([...picks]);
    setRevealed([]);
    setResult("");
    setActive(true);
  };
  const clickTile = (index: number) => {
    if (!active || revealed.includes(index)) return;
    if (mines.includes(index)) {
      setResult(`Mine hit. Lost ${currency.format(stake)}.`);
      settle("Mines", -stake);
      setActive(false);
    } else {
      setRevealed((items) => [...items, index]);
    }
  };
  const cashOut = () => {
    const profit = payout(stake, multiplier) - stake;
    setResult(`Cashed out ${multiplier}x. Won +${currency.format(profit)}.`);
    settle("Mines cash out", profit);
    setActive(false);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-md border border-blue-300/20 bg-blue-950/40 p-4">
        <ModalStake stake={stake} setStake={setStake} disabled={active} />
        <label className="mt-4 block text-xs uppercase text-slate-300">Mines: {mineCount}</label>
        <input disabled={active} type="range" min="1" max="24" value={mineCount} onChange={(event) => setMineCount(Number(event.target.value))} className="w-full accent-emerald-400" />
        <div className="mt-4 text-4xl font-black text-emerald-300">{multiplier.toFixed(2)}x</div>
        <button disabled={active || stake > balance} onClick={start} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">Start</button>
        <button disabled={!active || revealed.length === 0} onClick={cashOut} className="mt-2 w-full rounded-md bg-amber-300 py-3 font-black text-black disabled:opacity-40">Cash Out</button>
        <ResultBanner result={result} />
      </div>
      <div className={clsx("grid grid-cols-5 gap-2 rounded-md bg-blue-950/50 p-4", result.includes("Mine") && "animate-shake")}>
        {Array.from({ length: 25 }, (_, index) => {
          const showMine = !active && mines.includes(index);
          const safe = revealed.includes(index);
          return <button key={index} onClick={() => clickTile(index)} className={clsx("aspect-square rounded-md border border-blue-200/10 text-2xl font-black transition hover:scale-105", safe ? "bg-emerald-400 text-black" : showMine ? "bg-red-500 text-white" : "bg-slate-900")}>{safe ? "◆" : showMine ? "✹" : ""}</button>;
        })}
      </div>
    </div>
  );
}

function PlinkoModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const [risk, setRisk] = useState("Medium");
  const [path, setPath] = useState<number[]>([]);
  const [result, setResult] = useState("");
  const multipliers = risk === "High" ? [15, 5, 2, 0.3, 0.2, 0.3, 2, 5, 15] : risk === "Low" ? [2, 1.4, 1.1, 0.8, 0.5, 0.8, 1.1, 1.4, 2] : [10, 3, 1.5, 0.5, 0.2, 0.5, 1.5, 3, 10];
  const drop = () => {
    let position = 4;
    const steps = Array.from({ length: 8 }, () => {
      position += Math.random() > 0.5 ? 1 : -1;
      position = Math.max(0, Math.min(8, position));
      return position;
    });
    setPath(steps);
    const multi = multipliers[position];
    const profit = payout(stake, multi) - stake;
    window.setTimeout(() => {
      setResult(`${multi}x bucket. ${profit >= 0 ? `Won +${currency.format(profit)}` : `Lost ${currency.format(Math.abs(profit))}`}.`);
      settle("Plinko", profit);
    }, 900);
  };
  return (
    <div className="rounded-md bg-slate-950 p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><ModalStake stake={stake} setStake={setStake} /><Select value={risk} setValue={setRisk} options={["Low", "Medium", "High"]} /></div>
      <div className="relative mx-auto h-96 max-w-3xl rounded-md bg-black/40 p-4">
        {Array.from({ length: 8 }, (_, row) => <div key={row} className="flex justify-center gap-8 py-2">{Array.from({ length: row + 3 }, (_, peg) => <span key={peg} className="h-3 w-3 rounded-full bg-emerald-300" />)}</div>)}
        {path.length > 0 && <div className="absolute top-8 h-5 w-5 rounded-full bg-amber-300 transition-all duration-700" style={{ left: `${10 + (path[path.length - 1] ?? 4) * 9}%`, top: `${18 + path.length * 8}%` }} />}
        <div className="absolute bottom-3 left-3 right-3 grid grid-cols-9 gap-1">{multipliers.map((multi, index) => <div key={index} className="rounded bg-emerald-400/20 py-3 text-center text-sm font-black">{multi}x</div>)}</div>
      </div>
      <button disabled={stake > balance} onClick={drop} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">Drop Ball</button>
      <ResultBanner result={result} />
    </div>
  );
}

function DiceModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const [target, setTarget] = useState(50);
  const [mode, setMode] = useState("over");
  const [rollValue, setRollValue] = useState<number | null>(null);
  const chance = mode === "over" ? 100 - target : target;
  const multi = Number((95 / Math.max(1, chance)).toFixed(2));
  const roll = () => {
    const value = Math.floor(Math.random() * 100) + 1;
    setRollValue(value);
    const win = mode === "over" ? value > target : value < target;
    settle("Dice", win ? payout(stake, multi) - stake : -stake);
  };
  return (
    <div className="rounded-md bg-[linear-gradient(135deg,_#111827,_#064e3b)] p-5">
      <ModalStake stake={stake} setStake={setStake} />
      <div className="mt-6 flex h-48 items-center justify-center rounded-md bg-black/30 text-7xl font-black text-white">{rollValue ?? "?"}</div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Select value={mode} setValue={setMode} options={["over", "under"]} />
        <div className="text-sm text-slate-200">Win chance {chance}% - Payout {multi}x</div>
      </div>
      <input type="range" min="1" max="99" value={target} onChange={(event) => setTarget(Number(event.target.value))} className="mt-4 w-full accent-emerald-400" />
      <button disabled={stake > balance} onClick={roll} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">Roll {mode} {target}</button>
    </div>
  );
}

function HiLoModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const [card, setCard] = useState(7);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState("");
  const multi = Number((1 + streak * 0.55).toFixed(2));
  const guess = (dir: "Higher" | "Lower") => {
    const next = Math.floor(Math.random() * 13) + 1;
    const win = dir === "Higher" ? next > card : next < card;
    setCard(next);
    if (win) {
      setStreak((value) => value + 1);
      setResult(`${dir} correct. Streak ${streak + 1}.`);
    } else {
      setResult(`${dir} missed. Lost ${currency.format(stake)}.`);
      settle("HiLo", -stake);
      setStreak(0);
    }
  };
  const cash = () => {
    const profit = payout(stake, multi) - stake;
    setResult(`Cashed streak ${streak}. Won +${currency.format(profit)}.`);
    settle("HiLo cash out", profit);
    setStreak(0);
  };
  return (
    <div className="rounded-md bg-purple-950/40 p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={streak > 0} />
      <div className="mx-auto mt-6 flex h-72 max-w-48 items-center justify-center rounded-xl border-8 border-white bg-white text-7xl font-black text-black shadow-2xl">{card}</div>
      <div className="mt-4 text-center text-xl font-black text-emerald-300">Streak {streak} - {multi}x</div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button disabled={stake > balance && streak === 0} onClick={() => guess("Higher")} className="rounded-md bg-emerald-400 py-3 font-black text-black">Higher</button>
        <button disabled={stake > balance && streak === 0} onClick={() => guess("Lower")} className="rounded-md bg-amber-300 py-3 font-black text-black">Lower</button>
        <button disabled={streak === 0} onClick={cash} className="rounded-md bg-white py-3 font-black text-black disabled:opacity-40">Cash Out</button>
      </div>
      <ResultBanner result={result} />
    </div>
  );
}

function RouletteModalGame({ game, balance, settle }: { game: string; balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const [bets, setBets] = useState<number[]>([]);
  const [outsideBets, setOutsideBets] = useState<string[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [winning, setWinning] = useState<number | null>(null);
  const numbers = game.includes("American") ? Array.from({ length: 38 }, (_, index) => index) : Array.from({ length: 37 }, (_, index) => index);
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const totalBets = bets.length + outsideBets.length;
  const toggleOutsideBet = (label: string) => {
    setOutsideBets((items) => items.includes(label) ? items.filter((item) => item !== label) : [...items, label]);
  };
  const outsideBetWon = (label: string, result: number) => {
    if (result === 0 || result === 37) return false;
    if (label === "Red") return redNumbers.includes(result);
    if (label === "Black") return !redNumbers.includes(result);
    if (label === "Odd") return result % 2 === 1;
    return result % 2 === 0;
  };
  const spin = () => {
    if (!totalBets) return;
    setSpinning(true);
    window.setTimeout(() => {
      const result = numbers[Math.floor(Math.random() * numbers.length)];
      setWinning(result);
      setSpinning(false);
      const straightNet = bets.reduce((sum, number) => sum + (number === result ? stake * 35 : -stake), 0);
      const outsideNet = outsideBets.reduce((sum, label) => sum + (outsideBetWon(label, result) ? stake : -stake), 0);
      settle(game, straightNet + outsideNet);
    }, 3000);
  };
  return (
    <div className="rounded-md bg-green-950 p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={spinning} />
      <div className="mx-auto mt-6 flex h-64 w-64 items-center justify-center rounded-full border-[18px] border-red-900 bg-black shadow-2xl">
        <div className={clsx("flex h-44 w-44 items-center justify-center rounded-full border-8 border-amber-200 bg-green-800 text-5xl font-black", spinning && "animate-spin")}>{winning ?? "●"}</div>
      </div>
      <div className="mt-6 grid grid-cols-6 gap-1 md:grid-cols-12">
        {numbers.map((number) => <button key={number} onClick={() => setBets((items) => items.includes(number) ? items.filter((item) => item !== number) : [...items, number])} className={clsx("relative rounded py-3 text-sm font-black", number === 0 ? "bg-emerald-500 text-black" : number % 2 ? "bg-red-700" : "bg-zinc-900", bets.includes(number) && "ring-2 ring-amber-300")}>{number}{bets.includes(number) && <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-amber-300" />}</button>)}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">{["Red", "Black", "Odd", "Even"].map((item) => <button key={item} onClick={() => toggleOutsideBet(item)} className={clsx("rounded py-2 text-sm font-bold", outsideBets.includes(item) ? "bg-amber-300 text-black" : "bg-white/10")}>{item}</button>)}</div>
      <button disabled={spinning || totalBets === 0 || stake * totalBets > balance} onClick={spin} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">Spin</button>
    </div>
  );
}

function BlackjackModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const [player, setPlayer] = useState<number[]>([]);
  const [dealer, setDealer] = useState<number[]>([]);
  const [active, setActive] = useState(false);
  const [result, setResult] = useState("");
  const draw = () => Math.min(11, Math.floor(Math.random() * 13) + 1);
  const total = (cards: number[]) => cards.reduce((sum, card) => sum + card, 0);
  const deal = () => {
    setPlayer([draw(), draw()]);
    setDealer([draw(), draw()]);
    setResult("");
    setActive(true);
  };
  const stand = () => {
    const house = total(dealer) < 17 ? [...dealer, draw()] : dealer;
    setDealer(house);
    const p = total(player);
    const d = total(house);
    const win = p <= 21 && (d > 21 || p > d);
    const push = p === d;
    setResult(push ? "Push." : win ? `Won +${currency.format(stake)}` : `Lost ${currency.format(stake)}`);
    if (!push) settle("Blackjack", win ? stake : -stake);
    setActive(false);
  };
  return (
    <div className="rounded-md bg-[radial-gradient(circle,_#166534,_#052e16)] p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={active} />
      <div className="mt-6 grid gap-8">
        <CardHand title={`Dealer: ${active ? "?" : total(dealer) || 0}`} cards={dealer} hideFirst={active} />
        <CardHand title={`Player: ${total(player) || 0}`} cards={player} />
      </div>
      <div className="mt-6 grid grid-cols-4 gap-2">
        <button disabled={active || stake > balance} onClick={deal} className="rounded bg-emerald-400 py-3 font-black text-black disabled:opacity-40">Deal</button>
        <button disabled={!active} onClick={() => setPlayer((cards) => [...cards, draw()])} className="rounded bg-white/10 py-3 font-bold disabled:opacity-40">Hit</button>
        <button disabled={!active} onClick={stand} className="rounded bg-amber-300 py-3 font-black text-black disabled:opacity-40">Stand</button>
        <button disabled={!active || stake * 2 > balance} onClick={() => { setStake(stake * 2); setPlayer((cards) => [...cards, draw()]); }} className="rounded bg-white/10 py-3 font-bold disabled:opacity-40">Double</button>
      </div>
      <ResultBanner result={result} />
    </div>
  );
}

function CardHand({ title, cards, hideFirst }: { title: string; cards: number[]; hideFirst?: boolean }) {
  return (
    <div>
      <div className="mb-2 font-black text-white">{title}</div>
      <div className="flex gap-2">{cards.map((card, index) => <div key={`${card}-${index}`} className="flex h-28 w-20 items-center justify-center rounded-md bg-white text-3xl font-black text-black shadow-xl">{hideFirst && index === 0 ? "?" : card}</div>)}</div>
    </div>
  );
}

function SlotModalGame({ game, balance, settle }: { game: string; balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const symbols = game.includes("Soccer") ? ["⚽", "🥅", "🏆", "⭐", "🇧🇷"] : game.includes("Space") ? ["🚀", "🪐", "⭐", "🌙", "☄"] : game.includes("Fruit") ? ["🍒", "🍋", "🍇", "🍉", "7"] : ["💎", "👑", "7", "BAR", "★"];
  const [reels, setReels] = useState(["7", "💎", "👑", "BAR", "★"]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState("");
  const spin = () => {
    setSpinning(true);
    setResult("");
    const final = Array.from({ length: 5 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
    window.setTimeout(() => {
      setReels(final);
      setSpinning(false);
      const counts = final.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item]: (acc[item] ?? 0) + 1 }), {});
      const best = Math.max(...Object.values(counts));
      const amount = best >= 4 ? payout(stake, 8) - stake : best >= 3 ? payout(stake, 2) - stake : -stake;
      setResult(amount >= 0 ? `Payline hit. Won +${currency.format(amount)}` : `No line. Lost ${currency.format(stake)}`);
      settle(game, amount);
    }, 1100);
  };
  return (
    <div className="rounded-md bg-[linear-gradient(135deg,_#4c0519,_#78350f,_#111827)] p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={spinning} />
      <div className="mt-6 rounded-lg border-4 border-amber-300 bg-black p-4">
        <div className="grid grid-cols-5 gap-2">
          {reels.map((symbol, index) => <div key={`${symbol}-${index}`} className={clsx("flex h-32 items-center justify-center rounded-md bg-white text-5xl font-black text-black", spinning && "animate-bounce")}>{spinning ? symbols[(index + Math.floor(Math.random() * symbols.length)) % symbols.length] : symbol}</div>)}
        </div>
      </div>
      <button disabled={spinning || stake > balance} onClick={spin} className="mt-4 w-full rounded-md bg-amber-300 py-3 font-black text-black disabled:opacity-40">Spin</button>
      <ResultBanner result={result} />
    </div>
  );
}

function AimModalGame({ game, balance, settle }: { game: string; balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const [keeper, setKeeper] = useState<number | null>(null);
  const [shot, setShot] = useState<number | null>(null);
  const zones = Array.from({ length: 9 }, (_, index) => index);
  const shoot = (zone: number) => {
    const defend = Math.floor(Math.random() * 9);
    setShot(zone);
    setKeeper(defend);
    const win = zone !== defend;
    settle(game, win ? stake : -stake);
  };
  return (
    <div className="rounded-md bg-[linear-gradient(180deg,_#064e3b,_#14532d)] p-5">
      <ModalStake stake={stake} setStake={setStake} />
      <div className="mx-auto mt-6 max-w-2xl rounded-md border-8 border-white p-3">
        <div className="grid grid-cols-3 gap-2">
          {zones.map((zone) => <button disabled={stake > balance} key={zone} onClick={() => shoot(zone)} className={clsx("h-28 rounded bg-emerald-900/80 text-2xl font-black", shot === zone && "bg-amber-300 text-black", keeper === zone && "bg-red-500 text-white")}>{keeper === zone ? "GK" : shot === zone ? "●" : ""}</button>)}
        </div>
      </div>
      <div className="mt-4 text-center text-sm text-slate-200">{shot === null ? "Pick a target zone." : shot === keeper ? "Saved." : "Goal."}</div>
    </div>
  );
}

function MapModalGame({ game, balance, settle }: { game: string; balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const [result, setResult] = useState("");
  const cities = ["New York", "São Paulo", "Tokyo", "Paris", "Cairo", "Sydney", "Toronto"];
  const play = () => {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const win = Math.random() > 0.45;
    const amount = win ? stake : -stake;
    setResult(`${game}: ${city}. ${win ? `Won +${currency.format(amount)}` : `Lost ${currency.format(stake)}`}.`);
    settle(game, amount);
  };
  return (
    <div className="rounded-md bg-slate-100 p-5 text-slate-950">
      <ModalStake stake={stake} setStake={setStake} />
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative h-96 overflow-hidden rounded-md border border-slate-300 bg-[linear-gradient(135deg,_#bfdbfe,_#dcfce7)]">
          <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
          <div className="absolute left-1/2 top-1/2 rounded-full bg-red-500 px-3 py-2 font-black text-white shadow-xl">PIN</div>
        </div>
        <div className="rounded-md bg-white p-4 shadow">
          <h3 className="font-black">{game}</h3>
          <p className="mt-2 text-sm text-slate-600">Map challenge powered by OpenStreetMap-ready layout. Add Leaflet tiles for production map controls.</p>
          <button disabled={stake > balance} onClick={play} className="mt-4 w-full rounded-md bg-emerald-500 py-3 font-black text-black disabled:opacity-40">Play Map Round</button>
          <ResultBanner result={result} />
        </div>
      </div>
    </div>
  );
}

function InstantModalGame({ game, balance, settle }: { game: string; balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const [result, setResult] = useState("");
  const play = () => {
    const multiplier = [0, 0, 0.5, 1.5, 2, 5, 10][Math.floor(Math.random() * 7)];
    const amount = payout(stake, multiplier) - stake;
    setResult(multiplier > 1 ? `${multiplier}x. Won +${currency.format(amount)}.` : `Result ${multiplier}x. Lost ${currency.format(Math.abs(amount))}.`);
    settle(game, amount);
  };
  return (
    <div className="rounded-md bg-[linear-gradient(135deg,_#111827,_#312e81)] p-5">
      <ModalStake stake={stake} setStake={setStake} />
      <div className="mt-6 grid grid-cols-3 gap-3">
        {Array.from({ length: 9 }, (_, index) => <div key={index} className="flex h-24 items-center justify-center rounded-md bg-white/10 text-3xl font-black text-amber-200">?</div>)}
      </div>
      <button disabled={stake > balance} onClick={play} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">Play {game}</button>
      <ResultBanner result={result} />
    </div>
  );
}

function Select({ value, setValue, options }: { value: string; setValue: (value: string) => void; options: string[] }) {
  return <select value={value} onChange={(event) => setValue(event.target.value)} className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2">{options.map((option) => <option key={option}>{option}</option>)}</select>;
}

function WalletView({ balance, claimBonus, transactions, onDeposit }: { balance: number; claimBonus: () => void; transactions: Transaction[]; onDeposit: () => void }) {
  return (
    <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-5">
        <Wallet className="mb-3 h-8 w-8 text-amber-300" />
        <div className="text-sm uppercase text-amber-100">Balance</div>
        <div className="text-5xl font-black text-white">{currency.format(balance)}</div>
        <button onClick={onDeposit} className="mt-5 w-full rounded-md bg-emerald-400 py-3 font-black text-black">Deposit</button>
        <button onClick={claimBonus} className="mt-2 w-full rounded-md border border-white/10 bg-black/25 py-3 font-black text-white">Claim daily bonus</button>
      </div>
      <TransactionList transactions={transactions} />
    </section>
  );
}

function TransactionList({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0b1210] p-4">
      <h2 className="mb-3 font-black text-white">Transaction history</h2>
      <div className="space-y-2">
        {transactions.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-white/[0.04] px-3 py-3 text-sm">
            <div>
              <div className="font-bold text-white">{item.label}</div>
              <div className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()} - {item.type.replace("_", " ")}</div>
              <div className="text-xs text-slate-500">Balance after {currency.format(item.balanceAfter ?? 0)}</div>
            </div>
            <div className={item.amount >= 0 ? "text-emerald-300" : "text-red-300"}>{item.amount >= 0 ? "+" : ""}{currency.format(item.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepositModal({ open, onClose, onComplete }: { open: boolean; onClose: () => void; onComplete: (amount: number) => void }) {
  const [amount, setAmount] = useState(50);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const transactionId = useMemo(() => `HB-${Math.random().toString(36).slice(2, 10).toUpperCase()}`, [status]);

  if (!open) return null;

  const submit = () => {
    setStatus("loading");
    window.setTimeout(() => {
      onComplete(amount);
      setStatus("done");
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur">
      <div className="w-full max-w-lg rounded-md border border-white/10 bg-[#0b1210] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-white">Deposit</h2>
            <p className="text-sm text-slate-400">Choose an amount and payment method.</p>
          </div>
          <button onClick={() => { setStatus("idle"); onClose(); }} aria-label="Close deposit"><X className="h-5 w-5" /></button>
        </div>
        {status !== "done" ? (
          <>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[10, 25, 50, 100, 200, 500].map((value) => (
                <button key={value} onClick={() => setAmount(value)} className={clsx("rounded-md border py-3 font-black", amount === value ? "border-emerald-300 bg-emerald-400 text-black" : "border-white/10 bg-white/5 text-white")}>{currency.format(value)}</button>
              ))}
            </div>
            <label className="mt-4 block text-xs uppercase text-slate-400">
              Custom amount
              <input type="number" min={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3 text-base text-white" />
            </label>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs font-black">
              {["VISA", "MC", "PIX", "BTC"].map((method) => <div key={method} className="rounded-md border border-white/10 bg-white/5 py-3 text-slate-200">{method}</div>)}
            </div>
            <button disabled={status === "loading"} onClick={submit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-70">
              {status === "loading" && <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />}
              {status === "loading" ? "Processing" : `Deposit ${currency.format(amount || 0)}`}
            </button>
          </>
        ) : (
          <div className="mt-5 rounded-md border border-emerald-300/30 bg-emerald-400/10 p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400 text-black"><Crown className="h-6 w-6" /></div>
            <div className="text-xl font-black text-white">Deposit Successful</div>
            <div className="mt-2 text-sm text-slate-300">{currency.format(amount)} added to your balance.</div>
            <div className="mt-3 rounded bg-black/25 px-3 py-2 text-xs text-amber-200">Transaction ID: {transactionId}</div>
            <button onClick={() => { setStatus("idle"); onClose(); }} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black">Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileView({ user, setUser, balance, bets, winCount, lossCount }: { user: AppUser | null; setUser: (user: AppUser | null) => void; balance: number; bets: Bet[]; winCount: number; lossCount: number }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const decidedBets = winCount + lossCount;
  const winRate = decidedBets ? `${Math.round((winCount / decidedBets) * 100)}%` : "0%";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setUser({ name: name || "Henrique", email: email || "player@henriquinhobets.local" });
  };
  return (
    <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={submit} className="rounded-md border border-white/10 bg-[#0b1210] p-4">
        <LogIn className="mb-3 h-7 w-7 text-emerald-300" />
        <h2 className="font-black text-white">Supabase Auth ready</h2>
        <p className="mt-1 text-sm text-slate-400">Add Supabase keys to enable hosted registration, login, password reset, and isolated account data.</p>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className="mt-4 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3" />
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3" />
        <button className="mt-3 w-full rounded-md bg-emerald-400 py-3 font-black text-black">Register / login</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Balance" value={currency.format(balance)} />
        <Stat label="Wins" value={String(winCount)} />
        <Stat label="Losses" value={String(lossCount)} />
        <Stat label="Win rate" value={winRate} />
        <div className="sm:col-span-4"><BetHistory bets={bets} settleBet={() => undefined} /></div>
      </div>
    </section>
  );
}

function AdminView({ bets, transactions }: { bets: Bet[]; transactions: Transaction[] }) {
  const totalVolume = transactions.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const gameCounts = transactions
    .filter((item) => item.type === "casino_win" || item.type === "casino_loss")
    .reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.label.split(" ")[0]]: (acc[item.label.split(" ")[0]] ?? 0) + 1 }), {});
  const mostPlayed = Object.entries(gameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Connect Supabase";
  return (
    <section className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total users" value="1 current" />
        <Stat label="Total bets" value={String(bets.length)} />
        <Stat label="Volume" value={currency.format(totalVolume)} />
        <Stat label="Top game" value={mostPlayed} />
      </div>
      <div className="rounded-md border border-white/10 bg-[#0b1210] p-4">
        <h2 className="mb-3 font-black text-white">Automation status</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {["ESPN scoreboards", "Calculated market odds", "Supabase realtime wallet"].map((item) => <div key={item} className="rounded-md bg-emerald-400/10 p-4 text-emerald-100"><Crown className="mb-2 h-5 w-5" />{item}<div className="mt-1 text-xs text-slate-400">Ready for production</div></div>)}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-white/10 bg-[#0b1210] p-4"><div className="text-xs uppercase text-slate-400">{label}</div><div className="mt-1 text-2xl font-black text-white">{value}</div></div>;
}

function Leaderboard({ user, balance }: { user: AppUser | null; balance: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0b1210] p-4">
      <h2 className="mb-3 flex items-center gap-2 font-black text-white"><Trophy className="h-5 w-5 text-amber-300" />Leaderboard</h2>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-md bg-white/[0.04] px-3 py-2 text-sm"><div><span className="mr-2 text-amber-200">#1</span>{user?.name ?? "Guest"}<div className="text-xs text-slate-400">Current account</div></div><b>{currency.format(balance)}</b></div>
        <div className="rounded-md bg-white/[0.04] px-3 py-3 text-xs text-slate-400">Connect Supabase to rank all registered users by balance.</div>
      </div>
    </div>
  );
}

function BetHistory({ bets, settleBet }: { bets: Bet[]; settleBet: (id: string) => void }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0b1210] p-4">
      <h2 className="mb-3 font-black text-white">Bet history</h2>
      <div className="space-y-2">
        {bets.length === 0 && <div className="rounded-md bg-white/[0.04] p-3 text-sm text-slate-400">No bets placed yet.</div>}
        {bets.map((bet) => <div key={bet.id} className="rounded-md bg-white/[0.04] p-3 text-sm"><div className="flex items-center justify-between"><b>{bet.picks.length > 1 ? "Parlay" : "Single"} - {currency.format(bet.stake)}</b><span className={clsx("rounded px-2 py-1 text-xs", bet.status === "won" ? "bg-emerald-400/20 text-emerald-200" : bet.status === "lost" ? "bg-red-400/20 text-red-200" : "bg-amber-300/20 text-amber-100")}>{bet.status}</span></div><div className="mt-1 text-xs text-slate-400">{bet.picks.map((pick) => pick.label).join(" + ")}</div><div className="mt-2 flex items-center justify-between text-xs"><span>To win {currency.format(bet.potentialWin)}</span>{bet.status === "open" && <button onClick={() => settleBet(bet.id)} className="rounded bg-emerald-400 px-2 py-1 font-bold text-black">Settle</button>}</div></div>)}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#050807] px-4 py-8">
      <div className="mx-auto flex max-w-[1540px] flex-col gap-4 text-sm text-slate-400 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 font-black text-white"><Crown className="h-5 w-5 text-amber-300" /> HenriquinhoBets <span className="rounded border border-emerald-300/30 px-2 py-1 text-xs text-emerald-200">Licensed & Regulated</span></div>
        <div className="flex flex-wrap gap-4">
          {["Responsible Gaming", "Privacy Policy", "Terms & Conditions", "Contact Us", "Affiliates"].map((item) => <a key={item} href="#" className="hover:text-white">{item}</a>)}
        </div>
      </div>
    </footer>
  );
}
