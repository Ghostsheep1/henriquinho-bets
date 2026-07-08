"use client";

import {
  Activity,
  BarChart3,
  Crown,
  Gamepad2,
  Goal,
  Info,
  Languages,
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

type AppUser = { name: string; email: string; guest?: boolean; admin?: boolean };
type LockedAccount = { email: string; name: string; lockedAt: string; reason: string };
type Language = "en" | "es" | "pt" | "fr" | "de" | "it" | "zh" | "ja" | "ko" | "ar" | "hi";
type RiskSignals = { level: string; casinoLosses: number; depositCount: number; recentLossVolume: number };
type VersionPayload = { version?: string };

const adminEmail = "henrique@henriquinhobets.com";
const adminPassword = "HenriqueAdmin2026!";
const supportEmail = "hsribeiro1@gmail.com";
const casinoHouseEdge = 0.04;
type VolatilityMode = "Chill" | "Turbo" | "Wild";

const volatilityProfiles: Record<VolatilityMode, { edge: number; variance: number; bonusChance: number; note: string }> = {
  Chill: { edge: 0.025, variance: 0.75, bonusChance: 0.08, note: "Lower swings" },
  Turbo: { edge: 0.04, variance: 1, bonusChance: 0.12, note: "Balanced action" },
  Wild: { edge: 0.06, variance: 1.35, bonusChance: 0.18, note: "Bigger swings" },
};

const leaguePopularity: Record<string, number> = {
  "FIFA World Cup": 100,
  "UEFA Euro": 96,
  "Champions League": 94,
  "Premier League": 92,
  NBA: 88,
  NFL: 87,
  "Copa Libertadores": 84,
  "Brazilian Serie A": 82,
  "La Liga": 80,
  "Serie A": 78,
  Bundesliga: 76,
  "Ligue 1": 74,
  MLS: 70,
  MLB: 68,
  NHL: 66,
  "Europa League": 64,
  "Olympic Soccer": 62,
  "FIFA Women's World Cup": 60,
  "Conference League": 56,
  NWSL: 52,
  "UFC/MMA": 50,
};

const languageLabels: Record<Language, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  ar: "العربية",
  hi: "हिन्दी",
};

const copy: Record<Language, Record<string, string>> = {
  en: {
    "nav.sports": "Sportsbook",
    "nav.live": "In-play",
    "nav.casino": "Casino",
    "nav.wallet": "Wallet",
    "nav.profile": "Profile",
    "nav.admin": "Admin",
    "login.title": "Enter HenriquinhoBets",
    "login.subtitle": "Login, create a beta profile, or join as a guest to test live markets, wallet history, and the casino lobby.",
    "login.submit": "Login / Create beta account",
    "login.guest": "Join as guest",
    "login.password": "Password",
    "hero.badge": "live odds, casino games, premium markets",
    "hero.copy": "Sports betting, casino games, live markets, wallet history, leaderboard, and account analytics in one polished dark trading floor.",
    "hero.odds": "Browse odds",
    "hero.casino": "Play casino",
    "common.balance": "Balance",
    "common.deposit": "Deposit",
    "market.empty": "Markets appear here as soon as official scoreboards return scheduled or live events.",
  },
  pt: {
    "nav.sports": "Apostas",
    "nav.live": "Ao vivo",
    "nav.casino": "Cassino",
    "nav.wallet": "Carteira",
    "nav.profile": "Perfil",
    "nav.admin": "Admin",
    "login.title": "Entrar no HenriquinhoBets",
    "login.subtitle": "Entre, crie um perfil beta ou jogue como convidado para testar mercados, carteira e cassino.",
    "login.submit": "Entrar / Criar conta beta",
    "login.guest": "Entrar como convidado",
    "login.password": "Senha",
    "hero.badge": "odds ao vivo, cassino, mercados premium",
    "hero.copy": "Apostas esportivas, cassino, mercados ao vivo, carteira, ranking e análises em uma plataforma escura e polida.",
    "hero.odds": "Ver odds",
    "hero.casino": "Jogar cassino",
    "common.balance": "Saldo",
    "common.deposit": "Depositar",
    "market.empty": "Os mercados aparecem assim que placares oficiais retornam eventos agendados ou ao vivo.",
  },
  es: {
    "nav.sports": "Apuestas",
    "nav.live": "En vivo",
    "nav.casino": "Casino",
    "nav.wallet": "Billetera",
    "nav.profile": "Perfil",
    "nav.admin": "Admin",
    "login.title": "Entrar a HenriquinhoBets",
    "login.subtitle": "Inicia sesión, crea un perfil beta o entra como invitado para probar mercados, billetera y casino.",
    "login.submit": "Entrar / Crear cuenta beta",
    "login.guest": "Entrar como invitado",
    "login.password": "Contraseña",
    "hero.badge": "cuotas en vivo, casino, mercados premium",
    "hero.copy": "Apuestas deportivas, casino, mercados en vivo, billetera, ranking y análisis en una plataforma oscura y pulida.",
    "hero.odds": "Ver cuotas",
    "hero.casino": "Jugar casino",
    "common.balance": "Saldo",
    "common.deposit": "Depositar",
    "market.empty": "Los mercados aparecen cuando marcadores oficiales devuelven eventos programados o en vivo.",
  },
  fr: {
    "nav.sports": "Paris sportifs",
    "nav.live": "En direct",
    "nav.casino": "Casino",
    "nav.wallet": "Portefeuille",
    "nav.profile": "Profil",
    "nav.admin": "Admin",
    "login.title": "Entrer sur HenriquinhoBets",
    "login.subtitle": "Connectez-vous, créez un profil beta ou entrez comme invité pour tester les marchés, le portefeuille et le casino.",
    "login.submit": "Connexion / Créer un compte beta",
    "login.guest": "Entrer comme invité",
    "login.password": "Mot de passe",
    "hero.badge": "cotes en direct, casino, marchés premium",
    "hero.copy": "Paris sportifs, jeux de casino, marchés live, portefeuille, classement et analyses dans une interface sombre et soignée.",
    "hero.odds": "Voir les cotes",
    "hero.casino": "Jouer au casino",
    "common.balance": "Solde",
    "common.deposit": "Déposer",
    "market.empty": "Les marchés apparaissent dès que les flux officiels renvoient des événements programmés ou en direct.",
  },
  de: {
    "nav.sports": "Sportwetten",
    "nav.live": "Live",
    "nav.casino": "Casino",
    "nav.wallet": "Wallet",
    "nav.profile": "Profil",
    "nav.admin": "Admin",
    "login.title": "HenriquinhoBets betreten",
    "login.subtitle": "Einloggen, Beta-Profil erstellen oder als Gast Märkte, Wallet und Casino testen.",
    "login.submit": "Einloggen / Beta-Konto erstellen",
    "login.guest": "Als Gast starten",
    "login.password": "Passwort",
    "hero.badge": "Live-Quoten, Casino, Premium-Märkte",
    "hero.copy": "Sportwetten, Casino-Spiele, Live-Märkte, Wallet, Rangliste und Kontoanalyse in einer polierten dunklen Oberfläche.",
    "hero.odds": "Quoten ansehen",
    "hero.casino": "Casino spielen",
    "common.balance": "Guthaben",
    "common.deposit": "Einzahlen",
    "market.empty": "Märkte erscheinen, sobald offizielle Feeds geplante oder Live-Events liefern.",
  },
  it: {
    "nav.sports": "Scommesse",
    "nav.live": "Live",
    "nav.casino": "Casinò",
    "nav.wallet": "Portafoglio",
    "nav.profile": "Profilo",
    "nav.admin": "Admin",
    "login.title": "Entra in HenriquinhoBets",
    "login.subtitle": "Accedi, crea un profilo beta o entra come ospite per testare mercati, portafoglio e casinò.",
    "login.submit": "Accedi / Crea account beta",
    "login.guest": "Entra come ospite",
    "login.password": "Password",
    "hero.badge": "quote live, casinò, mercati premium",
    "hero.copy": "Scommesse sportive, giochi da casinò, mercati live, portafoglio, classifica e analisi in una piattaforma scura e curata.",
    "hero.odds": "Vedi quote",
    "hero.casino": "Gioca al casinò",
    "common.balance": "Saldo",
    "common.deposit": "Deposita",
    "market.empty": "I mercati appaiono appena i feed ufficiali restituiscono eventi programmati o live.",
  },
  zh: {
    "nav.sports": "体育投注",
    "nav.live": "滚球",
    "nav.casino": "赌场",
    "nav.wallet": "钱包",
    "nav.profile": "资料",
    "nav.admin": "管理",
    "login.title": "进入 HenriquinhoBets",
    "login.subtitle": "登录、创建 beta 账号，或以访客身份测试赛事、钱包和赌场大厅。",
    "login.submit": "登录 / 创建 beta 账号",
    "login.guest": "访客进入",
    "login.password": "密码",
    "hero.badge": "实时赔率、赌场游戏、高级市场",
    "hero.copy": "体育投注、赌场游戏、实时市场、钱包、排行榜和账户分析，集中在精致的深色界面中。",
    "hero.odds": "浏览赔率",
    "hero.casino": "玩赌场",
    "common.balance": "余额",
    "common.deposit": "充值",
    "market.empty": "官方数据源返回赛程或直播赛事后，市场会显示在这里。",
  },
  ja: {
    "nav.sports": "スポーツブック",
    "nav.live": "ライブ",
    "nav.casino": "カジノ",
    "nav.wallet": "ウォレット",
    "nav.profile": "プロフィール",
    "nav.admin": "管理",
    "login.title": "HenriquinhoBets に入る",
    "login.subtitle": "ログイン、ベータアカウント作成、またはゲストで市場、ウォレット、カジノをテストできます。",
    "login.submit": "ログイン / ベータ作成",
    "login.guest": "ゲストで参加",
    "login.password": "パスワード",
    "hero.badge": "ライブオッズ、カジノ、プレミアム市場",
    "hero.copy": "スポーツベット、カジノ、ライブ市場、ウォレット、ランキング、分析を洗練されたダークUIで提供します。",
    "hero.odds": "オッズを見る",
    "hero.casino": "カジノで遊ぶ",
    "common.balance": "残高",
    "common.deposit": "入金",
    "market.empty": "公式フィードが予定またはライブイベントを返すと、ここに市場が表示されます。",
  },
  ko: {
    "nav.sports": "스포츠북",
    "nav.live": "라이브",
    "nav.casino": "카지노",
    "nav.wallet": "지갑",
    "nav.profile": "프로필",
    "nav.admin": "관리자",
    "login.title": "HenriquinhoBets 입장",
    "login.subtitle": "로그인, 베타 계정 생성 또는 게스트로 시장, 지갑, 카지노를 테스트하세요.",
    "login.submit": "로그인 / 베타 계정 생성",
    "login.guest": "게스트로 입장",
    "login.password": "비밀번호",
    "hero.badge": "실시간 배당, 카지노, 프리미엄 마켓",
    "hero.copy": "스포츠 베팅, 카지노 게임, 라이브 마켓, 지갑, 리더보드와 계정 분석을 세련된 다크 UI에서 제공합니다.",
    "hero.odds": "배당 보기",
    "hero.casino": "카지노 플레이",
    "common.balance": "잔액",
    "common.deposit": "입금",
    "market.empty": "공식 피드가 예정 또는 라이브 이벤트를 반환하면 여기에 마켓이 표시됩니다.",
  },
  ar: {
    "nav.sports": "المراهنات الرياضية",
    "nav.live": "مباشر",
    "nav.casino": "كازينو",
    "nav.wallet": "المحفظة",
    "nav.profile": "الملف",
    "nav.admin": "الإدارة",
    "login.title": "ادخل HenriquinhoBets",
    "login.subtitle": "سجل الدخول أو أنشئ حساب بيتا أو ادخل كضيف لاختبار الأسواق والمحفظة والكازينو.",
    "login.submit": "دخول / إنشاء حساب بيتا",
    "login.guest": "دخول كضيف",
    "login.password": "كلمة المرور",
    "hero.badge": "احتمالات مباشرة، كازينو، أسواق مميزة",
    "hero.copy": "مراهنات رياضية وألعاب كازينو وأسواق مباشرة ومحفظة وترتيب وتحليلات في واجهة داكنة مصقولة.",
    "hero.odds": "تصفح الاحتمالات",
    "hero.casino": "العب الكازينو",
    "common.balance": "الرصيد",
    "common.deposit": "إيداع",
    "market.empty": "تظهر الأسواق هنا عندما تعود المصادر الرسمية بالأحداث المجدولة أو المباشرة.",
  },
  hi: {
    "nav.sports": "स्पोर्ट्सबुक",
    "nav.live": "लाइव",
    "nav.casino": "कैसीनो",
    "nav.wallet": "वॉलेट",
    "nav.profile": "प्रोफाइल",
    "nav.admin": "एडमिन",
    "login.title": "HenriquinhoBets में प्रवेश करें",
    "login.subtitle": "लॉगिन करें, beta प्रोफाइल बनाएं, या गेस्ट बनकर मार्केट, वॉलेट और कैसीनो टेस्ट करें।",
    "login.submit": "लॉगिन / beta खाता बनाएं",
    "login.guest": "गेस्ट के रूप में आएं",
    "login.password": "पासवर्ड",
    "hero.badge": "लाइव odds, कैसीनो गेम्स, प्रीमियम मार्केट",
    "hero.copy": "स्पोर्ट्स बेटिंग, कैसीनो गेम्स, लाइव मार्केट, वॉलेट, लीडरबोर्ड और अकाउंट एनालिटिक्स एक polished dark interface में।",
    "hero.odds": "odds देखें",
    "hero.casino": "कैसीनो खेलें",
    "common.balance": "बैलेंस",
    "common.deposit": "डिपॉजिट",
    "market.empty": "जब official feeds scheduled या live events लौटाते हैं, markets यहां दिखाई देंगे।",
  },
};

function t(language: Language, key: string) {
  return copy[language][key] ?? copy.en[key] ?? key;
}

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && value in languageLabels;
}

function lockedAccountKey(user: AppUser | null) {
  return (user?.email || "guest@henriquinhobets.local").toLowerCase();
}

type SportsPayload = {
  source?: "odds-api" | "espn-public" | "henriquinho-model" | "henriquinho-internal";
  configured: boolean;
  matches: Match[];
  worldCup?: Match[];
  message: string;
  providerError?: string;
  realOddsOnly?: boolean;
  cached?: boolean;
  stale?: boolean;
  oddsSource?: "real-provider" | "model-provider" | "calculated-demo";
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

function fairWin(chance: number) {
  return Math.random() < Math.max(0.01, Math.min(0.99, chance - casinoHouseEdge));
}

function clampChance(chance: number) {
  return Math.max(0.01, Math.min(0.99, chance));
}

function useGameEngine(defaultMode: VolatilityMode = "Turbo") {
  const [mode, setMode] = useState<VolatilityMode>(defaultMode);
  const [rounds, setRounds] = useState(0);
  const [streak, setStreak] = useState(0);
  const [pulse, setPulse] = useState("Ready for a clean round");
  const profile = volatilityProfiles[mode];
  const effectiveChance = (chance: number) => clampChance(chance - profile.edge);
  const didWin = (chance: number) => Math.random() < effectiveChance(chance);
  const bonusBoost = () => {
    if (Math.random() > profile.bonusChance) return { multiplier: 1, label: "Standard reveal" };
    const boost = mode === "Wild" ? 1.6 : mode === "Turbo" ? 1.3 : 1.15;
    return { multiplier: boost, label: `${mode} boost ${boost.toFixed(2)}x` };
  };
  const finish = (amount: number, label?: string) => {
    setRounds((value) => value + 1);
    setStreak((value) => (amount > 0 ? value + 1 : 0));
    setPulse(label ?? (amount > 0 ? "Win pulse" : "Reset pulse"));
  };
  return { mode, setMode, rounds, streak, pulse, profile, effectiveChance, didWin, bonusBoost, finish };
}

type GameEngine = ReturnType<typeof useGameEngine>;

function resetLedger() {
  return starterTransactions.map((transaction) => ({ ...transaction, id: uid("txn"), createdAt: new Date().toISOString() }));
}

function matchKey(match: Match) {
  const date = Number.isFinite(new Date(match.startsAt).getTime()) ? new Date(match.startsAt).toISOString().slice(0, 10) : match.startsAt;
  return `${match.sport}:${match.league}:${match.home}:${match.away}:${date}`.toLowerCase();
}

function mergeMatch(existing: Match | undefined, incoming: Match) {
  if (!existing) return incoming;
  const incomingHasOdds = hasPlayableOdds(incoming);
  const existingHasOdds = hasPlayableOdds(existing);
  if (incomingHasOdds || (!existingHasOdds && incoming.source === "odds-api")) {
    return {
      ...existing,
      ...incoming,
      score: incoming.score ?? existing.score,
      minute: incoming.minute ?? existing.minute,
      odds: incoming.odds ?? existing.odds,
      oddsSource: incoming.oddsSource ?? existing.oddsSource,
      oddsProvider: incoming.oddsProvider ?? existing.oddsProvider,
      oddsUpdatedAt: incoming.oddsUpdatedAt ?? existing.oddsUpdatedAt,
    };
  }
  return {
    ...incoming,
    ...existing,
    score: incoming.score ?? existing.score,
    minute: incoming.minute ?? existing.minute,
    odds: existing.odds ?? incoming.odds,
    oddsSource: existing.oddsSource ?? incoming.oddsSource,
    oddsProvider: existing.oddsProvider ?? incoming.oddsProvider,
    oddsUpdatedAt: existing.oddsUpdatedAt ?? incoming.oddsUpdatedAt,
  };
}

function hasPlayableOdds(match: Match) {
  return Boolean(match.odds?.moneyline.home && match.odds.moneyline.away);
}

function isFreshMarket(match: Match) {
  const startsAt = new Date(match.startsAt).getTime();
  if (!Number.isFinite(startsAt)) return match.status === "live";
  if (match.status === "live") return true;
  return startsAt >= Date.now() - 48 * 60 * 60 * 1000;
}

function isInPlayMarket(match: Match) {
  const startsAt = new Date(match.startsAt).getTime();
  if (match.status === "live") return true;
  if (match.status !== "upcoming" || !Number.isFinite(startsAt)) return false;
  const timeUntilStart = startsAt - Date.now();
  return timeUntilStart >= 0 && timeUntilStart <= 24 * 60 * 60 * 1000;
}

function oddsAreFresh(match: Match) {
  if (match.source === "henriquinho-internal") return true;
  if (match.oddsSource === "model-provider") return true;
  if (match.oddsSource !== "real-provider") return false;
  const updatedAt = new Date(match.oddsUpdatedAt ?? "").getTime();
  if (!Number.isFinite(updatedAt)) return false;
  const maxAge = match.status === "live" ? 30 * 60 * 1000 : 2 * 60 * 60 * 1000;
  return Date.now() - updatedAt <= maxAge;
}

function bettingPaused(match: Match) {
  return Boolean(match.trader?.suspended) || (match.status === "live" && !oddsAreFresh(match));
}

function hasBookmakerOdds(match: Match) {
  return Boolean(match.odds?.moneyline.home && match.odds.moneyline.away);
}

function isActiveBookmakerMarket(match: Match) {
  const startsAt = new Date(match.startsAt).getTime();
  if (!hasBookmakerOdds(match) || match.status === "finished" || match.status === "postponed" || !Number.isFinite(startsAt)) return false;
  const age = Date.now() - startsAt;
  const future = startsAt - Date.now();
  return age <= 6 * 60 * 60 * 1000 && future <= 14 * 24 * 60 * 60 * 1000;
}

function isUpcomingMarket(match: Match) {
  const startsAt = new Date(match.startsAt).getTime();
  if (match.status !== "upcoming" || !Number.isFinite(startsAt)) return false;
  const timeUntilStart = startsAt - Date.now();
  return timeUntilStart >= 0 && timeUntilStart <= 14 * 24 * 60 * 60 * 1000;
}

function timeUntilStart(match: Match) {
  const startsAt = new Date(match.startsAt).getTime();
  return Number.isFinite(startsAt) ? startsAt - Date.now() : Number.MAX_SAFE_INTEGER;
}

function popularityScore(match: Match) {
  return leaguePopularity[match.league] ?? (match.sport === "soccer" ? 45 : 35);
}

function sportsbookRank(a: Match, b: Match) {
  if (hasBookmakerOdds(a) && !hasBookmakerOdds(b)) return -1;
  if (!hasBookmakerOdds(a) && hasBookmakerOdds(b)) return 1;
  const scoreGap = popularityScore(b) - popularityScore(a);
  if (scoreGap !== 0) return scoreGap;
  return timeUntilStart(a) - timeUntilStart(b);
}

function inPlayRank(a: Match, b: Match) {
  if (a.status === "live" && b.status !== "live") return -1;
  if (a.status !== "live" && b.status === "live") return 1;
  return timeUntilStart(a) - timeUntilStart(b);
}

function matchStatusLabel(match: Match) {
  if (match.status === "live") return match.minute ? `LIVE ${match.minute}` : "LIVE";
  if (isInPlayMarket(match)) return "Starting soon";
  return match.status;
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

function currentPickOdds(pick: BetPick, match?: Match) {
  if (!match?.odds || bettingPaused(match)) return null;
  if (pick.market === "moneyline") {
    if (pick.label === match.home) return match.odds.moneyline.home;
    if (pick.label === match.away) return match.odds.moneyline.away;
    if (pick.label === "Draw") return match.odds.moneyline.draw ?? null;
  }
  if (pick.market === "total" && match.odds.total) {
    if (pick.label.startsWith("Over")) return match.odds.total.over;
    if (pick.label.startsWith("Under")) return match.odds.total.under;
  }
  if (pick.market === "handicap" && match.odds.handicap) {
    if (pick.label.startsWith(match.home)) return match.odds.handicap.home;
    if (pick.label.startsWith(match.away)) return match.odds.handicap.away;
  }
  return null;
}

function cashOutOffer(bet: Bet, matchById: Map<string, Match>) {
  if (bet.status !== "open") return null;
  const currentOdds = bet.picks.map((pick) => currentPickOdds(pick, matchById.get(pick.matchId)));
  if (currentOdds.some((odds) => !odds)) return null;
  const currentCombined = currentOdds.filter((odds): odds is number => typeof odds === "number").reduce((total, odds) => total * odds, 1);
  if (currentCombined <= 1) return null;
  return Math.max(1, Math.floor((bet.potentialWin / currentCombined) * 0.96));
}

function useLiveSports(pollMs: number) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [worldCup, setWorldCup] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading markets");
  const loadedRef = useRef(false);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      if (!loadedRef.current) setLoading(true);
      try {
        const [oddsResponse, footballResponse] = await Promise.all([
          fetch("/api/odds", { cache: "no-store" }),
          fetch("/api/football", { cache: "no-store" }),
        ]);
        const odds = (await oddsResponse.json()) as SportsPayload;
        const football = (await footballResponse.json()) as SportsPayload;
        const byId = new Map<string, Match>();

        for (const match of [...(football.matches ?? []), ...(odds.matches ?? [])]) {
          const key = matchKey(match);
          byId.set(key, mergeMatch(byId.get(key), match));
        }

        const freshMatches = Array.from(byId.values())
          .filter(isFreshMarket)
          .sort((a, b) => {
            if (a.status === "live" && b.status !== "live") return -1;
            if (a.status !== "live" && b.status === "live") return 1;
            return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
          });

        if (!active) return;
        setMatches(freshMatches);
        setWorldCup((football.worldCup ?? []).filter(isFreshMarket));
        setMessage(odds.message || "Henriquinho model odds loaded");
        loadedRef.current = true;
      } catch {
        if (!active) return;
        if (!loadedRef.current) {
          setMatches([]);
          setWorldCup([]);
          setMessage("Markets updating soon");
        } else {
          setMessage("Refreshing markets in the background");
        }
      } finally {
        if (active) setLoading(false);
        refreshInFlightRef.current = false;
      }
    };

    load();
    const timer = window.setInterval(load, pollMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pollMs]);

  return { matches, worldCup, loading, message };
}

function useLatestIndexGate() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();
    const minVisibleMs = 650;
    const maxVisibleMs = 1500;

    const finish = () => {
      const remaining = Math.max(0, minVisibleMs - (Date.now() - startedAt));
      window.setTimeout(() => {
        if (active) setReady(true);
      }, remaining);
    };

    const verify = async () => {
      try {
        const response = await fetch(`/api/version?ts=${Date.now()}`, { cache: "no-store" });
        const payload = (await response.json()) as VersionPayload;
        const version = payload.version || "local-dev";
        const storageKey = "henriquinho-client-version";
        const reloadKey = "henriquinho-reloaded-version";
        const previousVersion = localStorage.getItem(storageKey);

        if (previousVersion && previousVersion !== version && sessionStorage.getItem(reloadKey) !== version) {
          localStorage.setItem(storageKey, version);
          sessionStorage.setItem(reloadKey, version);
          window.location.reload();
          return;
        }

        localStorage.setItem(storageKey, version);
      } catch {
        // The app should still open if the version endpoint is temporarily unreachable.
      }
      finish();
    };

    verify();
    const timeout = window.setTimeout(() => {
      if (active) setReady(true);
    }, maxVisibleMs);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, []);

  return ready;
}

function IndexLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070a0c] text-slate-100">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-300/20 border-t-emerald-300" />
    </main>
  );
}

export default function HenriquinhoApp() {
  const latestIndexReady = useLatestIndexGate();
  const [active, setActive] = useState("sports");
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [accessLocked, setAccessLocked] = useState(false);
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [balance, setBalance] = useState(1000);
  const [transactions, setTransactions] = useState<Transaction[]>(starterTransactions);
  const [bets, setBets] = useState<Bet[]>([]);
  const [slip, setSlip] = useState<BetPick[]>([]);
  const [stake, setStake] = useState(25);
  const [lastBonus, setLastBonus] = useState<string | null>(null);
  const [depositOpen, setDepositOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const { matches, worldCup, loading, message } = useLiveSports(active === "live" ? 15000 : 30000);
  const matchById = useMemo(() => new Map(matches.map((match) => [match.id, match])), [matches]);

  useEffect(() => {
    const rawLockedAccounts = localStorage.getItem("henriquinho-locked-accounts");
    const parsedLockedAccounts = rawLockedAccounts ? JSON.parse(rawLockedAccounts) as LockedAccount[] : [];
    setLockedAccounts(parsedLockedAccounts);
    const raw = localStorage.getItem("henriquinho-state-v2");
    if (raw) {
      const parsed = JSON.parse(raw) as {
        user: AppUser | null;
        balance: number;
        transactions: Transaction[];
        bets: Bet[];
        lastBonus: string | null;
        hasEntered?: boolean;
        language?: Language;
      };
      setUser(parsed.user);
      setHasEntered(Boolean(parsed.hasEntered && parsed.user));
      const currentLockKey = localStorage.getItem("henriquinho-access-lock");
      const savedUserKey = lockedAccountKey(parsed.user);
      const savedUserIsAdmin = Boolean(parsed.user?.admin);
      if (currentLockKey === "true") localStorage.removeItem("henriquinho-access-lock");
      const savedUserLocked = parsed.user
        ? currentLockKey === savedUserKey || parsedLockedAccounts.some((account) => account.email === savedUserKey)
        : Boolean(currentLockKey && currentLockKey !== "true");
      setAccessLocked(Boolean(savedUserLocked && !savedUserIsAdmin));
      if (savedUserIsAdmin && currentLockKey) localStorage.removeItem("henriquinho-access-lock");
      if (isLanguage(parsed.language)) setLanguage(parsed.language);
      setBalance(parsed.balance);
      setTransactions((parsed.transactions ?? starterTransactions).map((transaction) => ({
        ...transaction,
        balanceAfter: transaction.balanceAfter ?? parsed.balance ?? 1000,
      })));
      setBets(parsed.bets ?? []);
      setLastBonus(parsed.lastBonus);
    } else {
      const orphanLock = localStorage.getItem("henriquinho-access-lock");
      if (orphanLock === "true") localStorage.removeItem("henriquinho-access-lock");
      setAccessLocked(Boolean(orphanLock && orphanLock !== "true"));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("henriquinho-state-v2", JSON.stringify({ user, balance, transactions, bets, lastBonus, hasEntered, language }));
  }, [user, balance, transactions, bets, lastBonus, hasEntered, language, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("henriquinho-locked-accounts", JSON.stringify(lockedAccounts));
  }, [hydrated, lockedAccounts]);

  const isAdmin = Boolean(user?.admin);

  useEffect(() => {
    if (active === "admin" && !isAdmin) setActive("sports");
  }, [active, isAdmin]);

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
  const slipMaxStake = slip.length ? Math.min(...slip.map((pick) => pick.maxStake ?? Number.MAX_SAFE_INTEGER), balance) : balance;

  const placeBet = () => {
    if (!slip.length || stake <= 0 || stake > balance || stake > slipMaxStake) return;
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

  const cashOutBet = (id: string) => {
    let offer = 0;
    setBets((items) =>
      items.map((bet) => {
        if (bet.id !== id || bet.status !== "open") return bet;
        const value = cashOutOffer(bet, matchById);
        if (!value) return bet;
        offer = value;
        return { ...bet, status: "cashed_out", cashOut: value };
      }),
    );
    if (offer > 0) window.setTimeout(() => addTransaction("bet_cashout", offer, "Bet cash out"), 0);
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

  const signOut = () => {
    setUser(null);
    setHasEntered(false);
    setSlip([]);
    setActive("sports");
  };

  const lockAccess = () => {
    if (user?.admin) return;
    const email = lockedAccountKey(user);
    setLockedAccounts((items) => {
      const nextLock: LockedAccount = {
        email,
        name: user?.name ?? "Guest Player",
        lockedAt: new Date().toISOString(),
        reason: "Self-exclusion request",
      };
      return [nextLock, ...items.filter((item) => item.email !== email)];
    });
    localStorage.setItem("henriquinho-access-lock", email);
    setAccessLocked(true);
    setUser(null);
    setHasEntered(false);
    setSlip([]);
    setActive("sports");
  };

  const enterBeta = (profile: AppUser) => {
    const email = lockedAccountKey(profile);
    if (!profile.admin && lockedAccounts.some((account) => account.email === email)) {
      localStorage.setItem("henriquinho-access-lock", email);
      setAccessLocked(true);
      return;
    }
    if (profile.admin) {
      localStorage.removeItem("henriquinho-access-lock");
      setAccessLocked(false);
    }
    setUser(profile);
    setBalance(1000);
    setTransactions(resetLedger());
    setBets([]);
    setSlip([]);
    setLastBonus(null);
    setActive("sports");
    setHasEntered(true);
  };

  const adminUnlockDevice = (profile: AppUser) => {
    localStorage.removeItem("henriquinho-access-lock");
    setAccessLocked(false);
    setLockedAccounts((items) => items.filter((item) => item.email !== lockedAccountKey(profile)));
    enterBeta(profile);
  };

  const unlockAccount = (email: string) => {
    const normalized = email.toLowerCase();
    setLockedAccounts((items) => items.filter((item) => item.email !== normalized));
    if (localStorage.getItem("henriquinho-access-lock") === normalized || lockedAccountKey(user) === normalized) {
      localStorage.removeItem("henriquinho-access-lock");
      setAccessLocked(false);
    }
  };

  const winCount = bets.filter((bet) => bet.status === "won").length;
  const lossCount = bets.filter((bet) => bet.status === "lost").length;
  const riskSignals = useMemo(() => {
    const casinoLosses = transactions.filter((item) => item.type === "casino_loss").length;
    const depositCount = transactions.filter((item) => item.type === "deposit").length;
    const recentLossVolume = transactions.filter((item) => item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const level = casinoLosses >= 5 || depositCount >= 3 || recentLossVolume >= 500 ? "Elevated" : "Normal";
    return { level, casinoLosses, depositCount, recentLossVolume };
  }, [transactions]);

  if (!latestIndexReady || !hydrated) {
    return <IndexLoadingScreen />;
  }

  if (accessLocked) {
    return <LockedScreen onAdminUnlock={adminUnlockDevice} />;
  }

  if (!hasEntered) {
    return <LoginGate language={language} setLanguage={setLanguage} onEnter={enterBeta} />;
  }

  return (
    <div className="min-h-screen bg-[#070a0c] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(12,159,89,0.22),_transparent_34%),linear-gradient(135deg,_#070a0c_0%,_#0d1712_45%,_#141006_100%)]" />
      <LiveTicker matches={matches} message={message} />
      <Header user={user} balance={balance} soundOn={soundOn} setSoundOn={setSoundOn} onMenu={() => setMenuOpen(true)} onDeposit={() => setDepositOpen(true)} onSignOut={signOut} language={language} setLanguage={setLanguage} />
      <div className="mx-auto flex max-w-[1540px] gap-4 px-3 pb-8 pt-3 sm:px-5">
        <Sidebar active={active} setActive={setActive} open={menuOpen} setOpen={setMenuOpen} language={language} isAdmin={isAdmin} />
        <main className="min-w-0 flex-1 space-y-4">
          <Hero setActive={setActive} language={language} />
          {active === "sports" && <Sportsbook matches={matches} worldCup={worldCup} loading={loading} message={message} slip={slip} setSlip={setSlip} />}
          {active === "live" && <Sportsbook liveOnly matches={matches} worldCup={worldCup} loading={loading} message={message} slip={slip} setSlip={setSlip} />}
          {active === "casino" && <Casino balance={balance} soundOn={soundOn} onResult={casinoResult} />}
          {active === "wallet" && <WalletView user={user} balance={balance} claimBonus={claimBonus} transactions={transactions} onDeposit={() => setDepositOpen(true)} onLock={lockAccess} riskSignals={riskSignals} />}
          {active === "profile" && <ProfileView user={user} setUser={setUser} balance={balance} bets={bets} winCount={winCount} lossCount={lossCount} onLock={lockAccess} riskSignals={riskSignals} settleBet={settleBet} cashOutBet={cashOutBet} cashOutValue={(bet) => cashOutOffer(bet, matchById)} />}
          {active === "admin" && isAdmin && <AdminView bets={bets} transactions={transactions} lockedAccounts={lockedAccounts} unlockAccount={unlockAccount} />}
        </main>
        <aside className="hidden w-80 shrink-0 space-y-4 xl:block">
          <BetSlip slip={slip} setSlip={setSlip} stake={stake} setStake={setStake} balance={balance} maxStake={slipMaxStake} placeBet={placeBet} combinedOdds={combinedOdds} potentialWin={potentialWin} />
          <Leaderboard user={user} balance={balance} />
          {!user?.guest && <BetHistory bets={bets} settleBet={settleBet} cashOutBet={cashOutBet} cashOutValue={(bet) => cashOutOffer(bet, matchById)} />}
        </aside>
      </div>
      <div className="sticky bottom-0 z-30 border-t border-white/10 bg-[#08100d]/95 p-3 backdrop-blur xl:hidden">
        <BetSlip compact slip={slip} setSlip={setSlip} stake={stake} setStake={setStake} balance={balance} maxStake={slipMaxStake} placeBet={placeBet} combinedOdds={combinedOdds} potentialWin={potentialWin} />
      </div>
      <Footer />
      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} onComplete={completeDeposit} />
    </div>
  );
}

function LoginGate({ language, setLanguage, onEnter }: { language: Language; setLanguage: (language: Language) => void; onEnter: (profile: AppUser) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [ageError, setAgeError] = useState("");
  const enterWithCredentials = () => {
    if (!ageConfirmed || !termsConfirmed) {
      setAgeError("You must confirm 18+ and accept the beta terms to enter.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const admin = normalizedEmail === adminEmail && password === adminPassword;
    onEnter({
      name: name.trim() || (admin ? "Henrique Admin" : "Beta Player"),
      email: normalizedEmail || "player@henriquinhobets.local",
      admin,
    });
  };
  const enterAsGuest = () => {
    if (!ageConfirmed || !termsConfirmed) {
      setAgeError("You must confirm 18+ and accept the beta terms to enter.");
      return;
    }
    onEnter({ name: "Guest Player", email: "guest@henriquinhobets.local", guest: true });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    enterWithCredentials();
  };
  return (
    <main className="min-h-screen bg-[#070a0c] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,.26),_transparent_34%),linear-gradient(135deg,_#050806_0%,_#0d1712_50%,_#171102_100%)]" />
      <section className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-4 py-8 sm:px-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-black uppercase text-amber-200">
            <Crown className="h-4 w-4" /> Beta access
          </div>
          <h1 className="text-4xl font-black text-white sm:text-7xl">Henriquinho<span className="text-amber-300">Bets</span></h1>
          <p className="mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">{t(language, "login.subtitle")}</p>
          <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
            {["$1,000 starter balance", "Live event feeds", "110 casino games"].map((item) => (
              <div key={item} className="rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm font-bold text-emerald-100">{item}</div>
            ))}
          </div>
        </div>
        <form onSubmit={submit} className="rounded-md border border-white/10 bg-[#0b1210] p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <LogIn className="h-8 w-8 text-emerald-300" />
            <LanguageSelect language={language} setLanguage={setLanguage} />
          </div>
          <h2 className="text-2xl font-black text-white">{t(language, "login.title")}</h2>
          <p className="mt-1 text-sm text-slate-400">Supabase auth hooks are ready; this beta profile starts with fresh testing funds.</p>
          <label className="mt-5 block text-xs uppercase text-slate-400">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3 text-base text-white" />
          </label>
          <label className="mt-3 block text-xs uppercase text-slate-400">
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3 text-base text-white" />
          </label>
          <label className="mt-3 block text-xs uppercase text-slate-400">
            {t(language, "login.password")}
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="beta password" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3 text-base text-white" />
          </label>
          <label className="mt-4 flex items-start gap-3 rounded-md border border-white/10 bg-black/25 p-3 text-sm text-slate-200">
            <input checked={ageConfirmed} onChange={(event) => { setAgeConfirmed(event.target.checked); setAgeError(""); }} type="checkbox" className="mt-1 h-4 w-4 accent-emerald-400" />
            <span>I confirm I am 18+ and understand this beta uses virtual coins only.</span>
          </label>
          <label className="mt-3 flex items-start gap-3 rounded-md border border-white/10 bg-black/25 p-3 text-sm text-slate-200">
            <input checked={termsConfirmed} onChange={(event) => { setTermsConfirmed(event.target.checked); setAgeError(""); }} type="checkbox" className="mt-1 h-4 w-4 accent-emerald-400" />
            <span>I accept the beta terms: sports events come from live feeds, sportsbook prices require a configured odds provider, and all balances are virtual coins only.</span>
          </label>
          {ageError && <div className="mt-2 rounded-md bg-red-500/15 px-3 py-2 text-xs font-bold text-red-200">{ageError}</div>}
          <button type="button" onClick={enterWithCredentials} className="mt-5 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400" disabled={!ageConfirmed || !termsConfirmed}>{t(language, "login.submit")}</button>
          <button type="button" onClick={enterAsGuest} className="mt-3 w-full rounded-md border border-amber-200/40 bg-amber-300/10 py-3 font-black text-amber-100 disabled:cursor-not-allowed disabled:opacity-45" disabled={!ageConfirmed || !termsConfirmed}>{t(language, "login.guest")}</button>
          <div className="mt-4 rounded-md bg-black/25 px-3 py-3 text-xs text-slate-400">Guest mode is for beta testing only. Hosted Supabase accounts can be connected after launch.</div>
        </form>
      </section>
    </main>
  );
}

function LockedScreen({ onAdminUnlock }: { onAdminUnlock: (profile: AppUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const unlock = (event: FormEvent) => {
    event.preventDefault();
    if (email.trim().toLowerCase() !== adminEmail || password !== adminPassword) {
      setError("Admin credentials required to unlock this beta device.");
      return;
    }
    onAdminUnlock({ name: "Henrique Admin", email: adminEmail, admin: true });
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#070a0c] px-4 text-slate-100">
      <section className="max-w-xl rounded-md border border-red-300/20 bg-[#0b1210] p-6 text-center shadow-2xl">
        <Crown className="mx-auto mb-4 h-10 w-10 text-amber-300" />
        <h1 className="text-3xl font-black text-white">Access locked</h1>
        <p className="mt-3 text-slate-300">
          This account/device requested a self-exclusion lock. Access to HenriquinhoBets is blocked.
        </p>
        <div className="mt-5 rounded-md border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
          To request access again, email <a className="font-black underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>.
        </div>
        <div className="mt-4 rounded-md bg-white/[0.04] p-4 text-left text-sm text-slate-300">
          If gambling ever stops feeling fun, pause immediately and talk to someone you trust. Virtual coins only, no real-money wagering.
        </div>
        <form onSubmit={unlock} className="mt-5 rounded-md border border-white/10 bg-black/25 p-4 text-left">
          <div className="text-sm font-black text-white">Admin recovery</div>
          <p className="mt-1 text-xs text-slate-400">Admin accounts cannot be self-excluded. Use your admin login to clear a mistaken beta lock.</p>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Admin email" className="mt-3 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3 text-sm text-white" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Admin password" className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3 text-sm text-white" />
          {error && <div className="mt-2 rounded bg-red-500/15 px-3 py-2 text-xs font-bold text-red-200">{error}</div>}
          <button className="mt-3 w-full rounded-md bg-emerald-400 py-3 font-black text-black">Unlock as admin</button>
        </form>
      </section>
    </main>
  );
}

function LanguageSelect({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-2 text-xs text-slate-200">
      <Languages className="h-4 w-4 text-emerald-300" />
      <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="bg-transparent font-bold outline-none">
        {(Object.keys(languageLabels) as Language[]).map((key) => <option key={key} value={key} className="bg-[#0b1210] text-white">{languageLabels[key]}</option>)}
      </select>
    </label>
  );
}

function Header({ user, balance, soundOn, setSoundOn, onMenu, onDeposit, onSignOut, language, setLanguage }: { user: AppUser | null; balance: number; soundOn: boolean; setSoundOn: (value: boolean) => void; onMenu: () => void; onDeposit: () => void; onSignOut: () => void; language: Language; setLanguage: (language: Language) => void }) {
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
          <div className="hidden sm:block">
            <LanguageSelect language={language} setLanguage={setLanguage} />
          </div>
          <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-2 text-right sm:px-3">
            <div className="text-[10px] uppercase text-amber-200">{t(language, "common.balance")}</div>
            <div className="font-black text-amber-100">{currency.format(balance)}</div>
          </div>
          <button onClick={onDeposit} className="hidden rounded-md bg-emerald-400 px-3 py-2 text-sm font-black text-black sm:block">{t(language, "common.deposit")}</button>
          <button onClick={() => setSoundOn(!soundOn)} className="rounded-md border border-white/10 bg-white/5 p-2" aria-label="Toggle sound">
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
          <div className="hidden rounded-md border border-white/10 bg-white/5 px-3 py-2 sm:block">
            <div className="text-xs text-slate-400">{user ? user.name : "Guest"}</div>
            <div className="text-sm font-semibold text-white">{user ? "Signed in" : "Sign in"}</div>
          </div>
          <button onClick={onSignOut} className="hidden rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10 md:block">Sign out</button>
        </div>
      </div>
    </header>
  );
}

function LiveTicker({ matches, message }: { matches: Match[]; message: string }) {
  const tickerMatches = useMemo(() => {
    const activeMarkets = matches.filter((match) => match.status === "live" || isInPlayMarket(match));
    return (activeMarkets.length ? activeMarkets : matches).slice(0, 24);
  }, [matches]);
  return (
    <div className="sticky top-0 z-40 overflow-hidden border-b border-emerald-300/20 bg-[#040706] py-2 text-xs">
      <div className="animate-marquee whitespace-nowrap text-slate-300">
        {matches.length === 0 && <span className="mx-6 text-amber-200">{message}</span>}
        {tickerMatches.map((match) => (
          <span key={match.id} className="mx-6">
            <span className={clsx("font-black", match.status === "live" ? "text-red-300" : "text-emerald-300")}>{matchStatusLabel(match)}</span>{" "}
            <span className="text-slate-400">{match.league}</span> {match.home} vs {match.away}{" "}
            <span className="text-amber-200">{match.score ?? (match.status === "upcoming" ? dateTime.format(new Date(match.startsAt)) : match.odds ? `${match.odds.moneyline.home}/${match.odds.moneyline.away}` : dateTime.format(new Date(match.startsAt)))}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Sidebar({ active, setActive, open, setOpen, language, isAdmin }: { active: string; setActive: (id: string) => void; open: boolean; setOpen: (open: boolean) => void; language: Language; isAdmin: boolean }) {
  const visibleNav = nav.filter((item) => item.id !== "admin" || isAdmin);
  return (
    <>
      <div className={clsx("fixed inset-0 z-40 bg-black/70 lg:hidden", open ? "block" : "hidden")} onClick={() => setOpen(false)} />
      <aside className={clsx("fixed left-0 top-0 z-50 h-full w-72 border-r border-white/10 bg-[#08100d] p-4 transition lg:sticky lg:top-24 lg:z-10 lg:h-[calc(100vh-7rem)] lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <span className="font-bold">Menu</span>
          <button onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-2">
          {visibleNav.map((item) => {
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
                {t(language, `nav.${item.id}`)}
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

function Hero({ setActive, language }: { setActive: (id: string) => void; language: Language }) {
  return (
    <section className="overflow-hidden rounded-md border border-white/10 bg-[linear-gradient(120deg,_rgba(6,95,70,.65),_rgba(21,16,5,.82)),url('https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1600&q=80')] bg-cover bg-center p-5 shadow-2xl sm:p-7">
      <div className="max-w-3xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-black/45 px-3 py-2 text-xs font-bold uppercase text-amber-200">
          <Sparkles className="h-4 w-4" /> {t(language, "hero.badge")}
        </div>
        <h1 className="text-4xl font-black text-white sm:text-6xl">HenriquinhoBets</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-200 sm:text-lg">
          {t(language, "hero.copy")}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="rounded-md bg-emerald-400 px-4 py-3 font-black text-black" onClick={() => setActive("sports")}>{t(language, "hero.odds")}</button>
          <button className="rounded-md border border-amber-200/50 bg-black/35 px-4 py-3 font-black text-amber-100" onClick={() => setActive("casino")}>{t(language, "hero.casino")}</button>
        </div>
      </div>
    </section>
  );
}

function Sportsbook({ liveOnly, matches, worldCup, loading, message, slip, setSlip }: { liveOnly?: boolean; matches: Match[]; worldCup: Match[]; loading: boolean; message: string; slip: BetPick[]; setSlip: React.Dispatch<React.SetStateAction<BetPick[]>> }) {
  const [sport, setSport] = useState<SportKey | "all">("all");
  const [league, setLeague] = useState("All leagues");
  const bettableMatches = useMemo(() => matches.filter(isActiveBookmakerMarket), [matches]);
  const scoreboardMatches = useMemo(() => matches.filter((match) => match.status === "live" || match.status === "upcoming"), [matches]);
  const visibleMatches = useMemo(() => {
    const source = bettableMatches.length > 0 ? bettableMatches : scoreboardMatches;
    const base = source.filter((match) => (sport === "all" || match.sport === sport) && (league === "All leagues" || match.league === league));
    if (liveOnly) return base.filter(isInPlayMarket).sort(inPlayRank);
    return base.sort(sportsbookRank);
  }, [bettableMatches, league, liveOnly, scoreboardMatches, sport]);
  const providerReady = message === "ok" || message.startsWith("Realtime bookmaker odds loaded") || message.startsWith("Showing last good bookmaker odds") || message.startsWith("Henriquinho model odds loaded") || message.startsWith("API-Football real fixture snapshot loaded");
  const providerBlocked = Boolean(message && !providerReady);
  const emptyMessage = providerBlocked && matches.length === 0 ? message : liveOnly ? "No live or starting-soon events" : "No events for this filter yet";
  const liveCount = bettableMatches.filter((match) => match.status === "live").length;
  const startingSoonCount = bettableMatches.filter((match) => match.status !== "live" && isInPlayMarket(match)).length;
  const upcomingCount = bettableMatches.length;
  const eventCount = scoreboardMatches.length;
  const addPick = (pick: BetPick) => {
    setSlip((items) => (items.some((item) => item.id === pick.id) ? items.filter((item) => item.id !== pick.id) : [...items.filter((item) => item.matchId !== pick.matchId || item.market !== pick.market), pick]));
  };

  return (
    <section className="space-y-4">
      <WorldCupPanel matches={worldCup} loading={loading} message={message} />
      <div className="grid gap-3 md:grid-cols-3">
        {liveOnly ? (
          <>
            <MarketModeStat label="Live first" value={loading ? "..." : `${liveCount} live`} note="Active events always appear at the top." />
            <MarketModeStat label="Next up" value={loading ? "..." : `${startingSoonCount} soon`} note="Upcoming within 24 hours, sorted by kickoff." />
            <MarketModeStat label="Closed hidden" value="No finals" note="Finished games stay out of the betting flow." />
          </>
        ) : (
          <>
            <MarketModeStat label="Upcoming board" value={loading ? "..." : `${eventCount} events`} note={upcomingCount ? `${upcomingCount} with bookmaker odds.` : "Real events shown; odds waiting on provider."} />
            <MarketModeStat label="Popularity sort" value="Major leagues first" note="World Cup, top soccer, NBA/NFL, then others." />
            <MarketModeStat label="No stale cards" value="14 day cap" note="Far-future and closed games are removed." />
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className={clsx("mr-2 rounded-md border px-3 py-2 text-sm font-bold", liveOnly ? "border-red-300/20 bg-red-500/10 text-red-100" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-100")}>
          {liveOnly ? "Live now + next 24h" : "Upcoming by demand"}
        </div>
        {(Object.keys(sportLabels) as Array<SportKey | "all">).map((key) => (
          <button key={key} onClick={() => setSport(key)} className={clsx("rounded-md border px-3 py-2 text-sm font-semibold", sport === key ? "border-emerald-300 bg-emerald-400 text-black" : "border-white/10 bg-white/5 text-slate-300")}>{sportLabels[key]}</button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-3">
          {loading && <SkeletonMarkets />}
          {!loading && visibleMatches.length === 0 && <EmptyMarkets message={emptyMessage} />}
          {visibleMatches.map((match) => (
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
                <span className="text-emerald-300">Tracked</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketModeStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0b1210] p-3">
      <div className="text-xs uppercase text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-black text-white">{value}</div>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
}

function WorldCupPanel({ matches, loading, message }: { matches: Match[]; loading: boolean; message: string }) {
  return (
    <section className="rounded-md border border-amber-300/20 bg-[linear-gradient(135deg,_rgba(5,150,105,.22),_rgba(251,191,36,.12))] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-amber-200">Featured Tournaments</div>
          <h2 className="text-2xl font-black text-white">World Cup, Euros, Olympics</h2>
        </div>
        <div className="rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200">Global soccer majors</div>
      </div>
      {loading && <div className="mt-4 grid gap-3 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-md bg-white/10" />)}</div>}
      {!loading && matches.length === 0 && <div className="mt-4 rounded-md bg-black/25 p-4 text-sm text-amber-100">{message}. Official scoreboards are updating soon.</div>}
      {!loading && matches.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {matches.slice(0, 6).map((match) => (
            <div key={match.id} className="rounded-md bg-black/25 p-3">
              <div className="text-xs uppercase text-emerald-300">{match.status}</div>
              <div className="text-xs uppercase text-amber-200">{match.league}</div>
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
      <p className="mt-2 text-sm text-slate-400">Markets appear here as soon as official scoreboards return scheduled or live events.</p>
    </div>
  );
}

function MatchCard({ match, addPick, slip }: { match: Match; addPick: (pick: BetPick) => void; slip: BetPick[] }) {
  const event = `${match.home} vs ${match.away}`;
  const paused = bettingPaused(match);
  const realOdds = match.oddsSource === "real-provider";
  const modelOdds = match.oddsSource === "model-provider";
  const internalOdds = match.source === "henriquinho-internal";
  const bettingOpen = (match.status === "live" || match.status === "upcoming") && !paused;
  const maxStake = match.risk?.maxStake;
  const picks: BetPick[] = match.odds && bettingOpen ? [
    { id: `${match.id}-home`, matchId: match.id, label: match.home, market: "moneyline", odds: match.odds.moneyline.home, event, maxStake },
    ...(match.odds.moneyline.draw ? [{ id: `${match.id}-draw`, matchId: match.id, label: "Draw", market: "moneyline" as const, odds: match.odds.moneyline.draw, event, maxStake }] : []),
    { id: `${match.id}-away`, matchId: match.id, label: match.away, market: "moneyline", odds: match.odds.moneyline.away, event, maxStake },
    ...(match.odds.total ? [
      { id: `${match.id}-over`, matchId: match.id, label: `Over ${match.odds.total.line}`, market: "total" as const, odds: match.odds.total.over, event, maxStake },
      { id: `${match.id}-under`, matchId: match.id, label: `Under ${match.odds.total.line}`, market: "total" as const, odds: match.odds.total.under, event, maxStake },
    ] : []),
    ...(match.odds.handicap ? [
      { id: `${match.id}-spread-home`, matchId: match.id, label: `${match.home} ${match.odds.handicap.line}`, market: "handicap" as const, odds: match.odds.handicap.home, event, maxStake },
      { id: `${match.id}-spread-away`, matchId: match.id, label: `${match.away} ${-match.odds.handicap.line}`, market: "handicap" as const, odds: match.odds.handicap.away, event, maxStake },
    ] : []),
  ] : [];
  return (
    <article className="rounded-md border border-white/10 bg-[#0b1210] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase text-slate-400">
            <span className={clsx("rounded px-2 py-1 font-bold", match.status === "live" ? "bg-red-500/20 text-red-200" : isInPlayMarket(match) ? "bg-amber-300/20 text-amber-100" : "bg-white/10")}>{matchStatusLabel(match)}</span>
            <span>{match.league}</span>
            <span>{match.country}</span>
          </div>
          <h3 className="mt-2 text-lg font-black text-white">{event}</h3>
          <p className="text-sm text-slate-400">{match.score ?? dateTime.format(new Date(match.startsAt))} {match.minute ? `- ${match.minute}` : ""}</p>
        </div>
        <div className={clsx("rounded-md px-3 py-2 text-sm font-bold", realOdds ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-300/10 text-amber-100")}>
          {paused ? "Odds refresh locked" : bettingOpen && match.odds ? realOdds ? "Realtime odds" : internalOdds ? "Internal demo odds" : modelOdds ? "Calculated odds" : "Calculated odds" : match.status === "finished" ? "Final" : "Odds unavailable"}
        </div>
      </div>
      {realOdds && match.oddsUpdatedAt && <div className="mt-3 rounded-md border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100">Provider: {match.oddsProvider}. Updated {new Date(match.oddsUpdatedAt).toLocaleTimeString()}.</div>}
      {!realOdds && match.odds && match.oddsUpdatedAt && <div className="mt-3 rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">Calculated from {match.source === "api-football" ? "API-Football real fixtures" : match.source === "henriquinho-internal" ? "Henriquinho internal demo data" : "real scoreboard fixtures"}. Updated {new Date(match.oddsUpdatedAt).toLocaleTimeString()}.</div>}
      {paused && <div className="mt-3 rounded-md border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100">{match.trader?.suspended ? `Market suspended${match.trader.note ? `: ${match.trader.note}` : ""}` : "Live betting paused until the odds provider refreshes this market."}</div>}
      {picks.length === 0 && <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-sm text-amber-100">{paused ? "Waiting for fresh live odds" : bettingOpen ? "No odds are available for this event yet." : "Betting closed"}</div>}
      {match.liveStats && <LiveStatsPanel match={match} />}
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

function LiveStatsPanel({ match }: { match: Match }) {
  const stats = match.liveStats;
  if (!stats) return null;
  return (
    <div className="mt-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-[11px] uppercase text-slate-500">
        <span>{stats.source === "api-football" ? "API-Football live stats" : stats.source === "henriquinho-internal" ? "Internal demo stats" : "Licensed live stats feed"}</span>
        <span>{stats.updatedAt ? `Updated ${new Date(stats.updatedAt).toLocaleTimeString()}` : match.status === "live" ? "Updating live" : "Verified feed"}</span>
      </div>
      <div className={clsx("grid gap-3", stats.heatmap ? "md:grid-cols-[1fr_120px]" : "")}>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <StatPill label="Poss" home={stats.possession.home} away={stats.possession.away} suffix="%" />
          {stats.xg ? <StatPill label="xG" home={stats.xg.home} away={stats.xg.away} /> : <StatPill label="Shots" home={stats.shots.home} away={stats.shots.away} />}
          <StatPill label="SOT" home={stats.shotsOnTarget.home} away={stats.shotsOnTarget.away} />
          <StatPill label="Mom" home={stats.momentum.home} away={stats.momentum.away} />
        </div>
        {stats.heatmap && (
          <div className="grid grid-cols-5 gap-1" aria-label="Match heatmap">
            {stats.heatmap.home.slice(0, 15).map((value, index) => (
              <span key={index} className="h-3 rounded-sm bg-emerald-400" style={{ opacity: 0.18 + value / 130 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatPill({ label, home, away, suffix = "" }: { label: string; home: number; away: number; suffix?: string }) {
  return (
    <div className="rounded bg-black/25 px-2 py-2">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="font-black text-slate-100">{home}{suffix} - {away}{suffix}</div>
    </div>
  );
}

function BetSlip({ compact: small, slip, setSlip, stake, setStake, balance, maxStake, placeBet, combinedOdds, potentialWin }: { compact?: boolean; slip: BetPick[]; setSlip: React.Dispatch<React.SetStateAction<BetPick[]>>; stake: number; setStake: (stake: number) => void; balance: number; maxStake: number; placeBet: () => void; combinedOdds: number; potentialWin: number }) {
  const stakeLimit = Math.min(balance, maxStake);
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
            {pick.maxStake && <div className="mt-1 text-[11px] text-slate-500">Market max {currency.format(pick.maxStake)}</div>}
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs uppercase text-slate-400">
          Stake
          <input value={stake} onChange={(event) => setStake(Number(event.target.value))} min={1} max={stakeLimit} type="number" className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-base text-white" />
        </label>
        <div className="rounded-md bg-amber-300/10 p-2">
          <div className="text-xs uppercase text-amber-200">Potential</div>
          <div className="font-black text-amber-100">{currency.format(potentialWin || 0)}</div>
        </div>
      </div>
      {slip.length > 0 && <div className="mt-2 text-xs text-slate-400">Account/market risk max: {currency.format(stakeLimit)}</div>}
      <button disabled={!slip.length || stake > balance || stake > stakeLimit} onClick={placeBet} className="mt-3 w-full rounded-md bg-emerald-400 px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
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
              <CasinoGameLogo name={name} group={group} index={index} />
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

function CasinoGameLogo({ name, group, index }: { name: string; group: (typeof casinoCategories)[number]; index: number }) {
  const exact: Record<string, string> = {
    Crash: "↗",
    Double: "×2",
    Mines: "◆",
    Plinko: "●",
    Dice: "⚂",
    Limbo: "∞",
    HiLo: "A↕",
    "Coin Flip": "$",
    Wheel: "◉",
    Tower: "▥",
    "European Roulette": "37",
    "American Roulette": "00",
    Blackjack: "21",
    Baccarat: "9",
    "Texas Hold'em Poker": "♠",
    "Video Poker": "♥",
    "Three Card Poker": "♣",
    "Dragon Tiger": "龍",
    "Sic Bo": "⚄",
    Keno: "80",
    "Pai Gow Poker": "牌",
    "Drop the Pin": "⌖",
    "City Roulette": "◎",
    "Distance Bet": "📍",
    "Penalty Shootout": "⚽",
    "Free Kick": "🥅",
    "Basketball Shots": "🏀",
    "Horse Racing": "🏁",
    "Greyhound Racing": "◇",
    "Quick Soccer": "⚽",
    "F1 Sprint": "F1",
  };
  const slotSymbols = ["🍒", "7", "♛", "✦", "◆", "☀", "⚡", "★"];
  const instantSymbols = ["✸", "▣", "$", "?", "✓", "★", "◇", "●"];
  const groupSymbol =
    exact[name] ??
    (group === "Slots" ? slotSymbols[index % slotSymbols.length] :
      group === "Instant Win" ? instantSymbols[index % instantSymbols.length] :
        group === "Live" ? `C${index + 1}` :
          name.slice(0, 2).toUpperCase());
  const accent =
    group === "Blaze Games" ? "from-emerald-400/30 via-black/30 to-red-500/25 text-emerald-100" :
      group === "Slots" ? "from-amber-300/30 via-black/30 to-fuchsia-500/25 text-amber-100" :
        group === "Table Games" ? "from-red-500/25 via-black/30 to-emerald-400/25 text-white" :
          group === "Sports Arcade" ? "from-sky-400/25 via-black/30 to-emerald-400/25 text-sky-100" :
            group === "Map Games" ? "from-lime-300/25 via-black/30 to-teal-500/25 text-lime-100" :
              "from-amber-300/20 via-black/30 to-emerald-400/20 text-amber-100";
  return (
    <div className={clsx("mb-4 flex h-24 items-center justify-center rounded-md border border-white/10 bg-gradient-to-br text-4xl font-black shadow-inner transition group-hover:scale-[1.02]", accent)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/35 text-center leading-none shadow-[0_0_30px_rgba(16,185,129,.18)]">{groupSymbol}</div>
    </div>
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
          <div className="flex items-center gap-2">
            <GameHelp game={game} />
            <button onClick={onClose} className="rounded-md border border-white/10 p-2" aria-label="Close game"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {renderGame(game, balance, settle)}
          <RoundActivity game={game} />
        </div>
      </div>
    </div>
  );
}

function RoundActivity({ game }: { game: string }) {
  const activity = useMemo(() => {
    const names = ["Mika", "Rafa", "Lia", "Bruno", "Sofia", "Theo", "Nina", "Mateo"];
    return Array.from({ length: 6 }, (_, index) => {
      const won = index < 4 || Math.random() > 0.35;
      const amount = Math.round((12 + Math.random() * 180) * (won ? 1 : 0.6));
      return {
        id: `${game}-${index}`,
        name: names[(game.length + index) % names.length],
        text: won ? `won ${currency.format(amount)}` : `played ${currency.format(amount)}`,
        positive: won,
      };
    });
  }, [game]);

  return (
    <section className="mt-4 rounded-md border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-black text-white">Beta activity</h3>
          <p className="text-xs text-slate-400">Simulated community results for launch testing, not real user winnings.</p>
        </div>
        <span className="rounded bg-emerald-400/10 px-2 py-1 text-xs font-bold text-emerald-200">Demo feed</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {activity.map((item) => (
          <div key={item.id} className="rounded-md bg-black/25 px-3 py-2 text-sm text-slate-200">
            <span className="font-bold text-white">{item.name}</span>{" "}
            <span className={item.positive ? "text-emerald-300" : "text-slate-400"}>{item.text}</span>
            <span className="ml-2 text-xs text-slate-500">{game}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const demoLeaderboard = [
  { name: "Lucas Martins", username: "@lucasm", balance: 18420 },
  { name: "Sofia Almeida", username: "@sofiabeta", balance: 15780 },
  { name: "Mateo Costa", username: "@mateoc", balance: 12960 },
  { name: "Isabella Santos", username: "@bellasantos", balance: 10240 },
  { name: "Rafael Pereira", username: "@rafap", balance: 9340 },
  { name: "Camila Rocha", username: "@camirocha", balance: 8120 },
];

function helpText(game: string) {
  if (game === "Crash") return "Start a round and cash out before the multiplier crashes. The longer you wait, the higher the payout and risk.";
  if (game === "Double") return "Pick red or black. The wheel spins, and a correct pick doubles your stake. A miss loses the stake.";
  if (game === "Mines") return "Start a board, reveal safe gems, then cash out before hitting a mine. More safe reveals increase the multiplier.";
  if (game === "Plinko") return "Choose risk, drop the ball, and watch it bounce through pegs into a multiplier bucket.";
  if (game === "Dice") return "Choose over or under, set the target number, then roll. Harder targets pay higher multipliers.";
  if (game === "Limbo") return "Set a target multiplier. If the rising result clears your target, you win the target payout.";
  if (game === "HiLo") return "Guess whether the next card will be higher or lower. Build a streak, then cash out before missing.";
  if (game === "Coin Flip") return "Pick a side and flip. Correct side pays double, wrong side loses the stake.";
  if (game.includes("Roulette")) return "Place chips on numbers or outside bets like red, black, odd, or even, then spin the wheel.";
  if (game === "Blackjack") return "Deal cards, hit or stand, and beat the dealer without going over 21.";
  if (game.includes("Slots") || game.includes("Reels") || game.includes("Crown")) return "Spin five reels. Three or more matching symbols trigger line wins.";
  if (game === "Penalty Shootout" || game === "Free Kick" || game === "Basketball Shots") return "Pick a target zone. Avoid the defender to score and win.";
  if (game === "Drop the Pin" || game === "City Roulette" || game === "Distance Bet") return "Play the map challenge and let the target city decide the round result.";
  return "Set your stake and play the round. The animated reveal shows the result and updates your balance.";
}

function GameHelp({ game }: { game: string }) {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center justify-center rounded-md border border-white/10 bg-white/5 p-2 text-slate-200 hover:bg-white/10" aria-label={`How to play ${game}`}>
        <Info className="h-5 w-5" />
      </summary>
      <div className="absolute right-0 top-11 z-20 w-72 rounded-md border border-amber-300/20 bg-[#0b1210] p-4 text-sm text-slate-200 shadow-2xl">
        <div className="mb-1 text-xs font-black uppercase text-amber-200">How to play</div>
        {helpText(game)}
      </div>
    </details>
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
  if (game === "Double" || game === "Coin Flip") return <DoubleModalGame game={game} balance={balance} settle={settle} />;
  if (game === "Mines") return <MinesModalGame balance={balance} settle={settle} />;
  if (game === "Plinko") return <PlinkoModalGame balance={balance} settle={settle} />;
  if (game === "Dice") return <DiceModalGame balance={balance} settle={settle} />;
  if (game === "Limbo") return <LimboModalGame balance={balance} settle={settle} />;
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

function EnginePanel({ engine }: { engine: GameEngine }) {
  return (
    <div className="mt-4 rounded-md border border-emerald-300/20 bg-emerald-400/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-emerald-200">Fun engine</div>
          <div className="text-xs text-slate-400">Transparent virtual play: mode changes variance and disclosed edge, not user targeting.</div>
        </div>
        <div className="flex rounded-md border border-white/10 bg-black/25 p-1">
          {(["Chill", "Turbo", "Wild"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => engine.setMode(mode)}
              className={clsx("rounded px-3 py-2 text-xs font-black", engine.mode === mode ? "bg-amber-300 text-black" : "text-slate-300 hover:bg-white/10")}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-4">
        <div className="rounded bg-black/25 px-3 py-2"><b className="text-white">{(engine.profile.edge * 100).toFixed(1)}%</b><br />edge</div>
        <div className="rounded bg-black/25 px-3 py-2"><b className="text-white">{engine.profile.note}</b><br />variance</div>
        <div className="rounded bg-black/25 px-3 py-2"><b className="text-white">{engine.streak}</b><br />hot streak</div>
        <div className="rounded bg-black/25 px-3 py-2"><b className="text-emerald-200">{engine.pulse}</b><br />round {engine.rounds}</div>
      </div>
    </div>
  );
}

function CrashModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const engine = useGameEngine("Turbo");
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
    engine.finish(-stake, `Crash ${crashAt.toFixed(2)}x`);
    settle("Crash", -stake);
  }, [crashAt, engine, multiplier, running, settle, stake]);

  const start = () => {
    settledRef.current = false;
    setResult("");
    setMultiplier(1);
    const r = Math.random();
    const variance = engine.profile.variance;
    const nextCrash = r < 0.58
      ? 1.01 + Math.random() * (1.45 * variance)
      : r < 0.9
        ? 2 + Math.random() * (3.5 * variance)
        : 5 + Math.random() * (12 * variance);
    setCrashAt(Number(Math.min(30, nextCrash).toFixed(2)));
    setRunning(true);
  };

  const cashOut = () => {
    if (!running) return;
    const profit = payout(stake, multiplier) - stake;
    settledRef.current = true;
    setRunning(false);
    setHistory((items) => [multiplier, ...items].slice(0, 20));
    setResult(`Cashed out at ${multiplier.toFixed(2)}x. Won +${currency.format(profit)}.`);
    engine.finish(profit, `Cashed ${multiplier.toFixed(2)}x`);
    settle("Crash cash out", profit);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="rounded-md border border-emerald-300/20 bg-black p-4 shadow-[0_0_50px_rgba(16,185,129,.15)]">
        <div className="mb-4 flex items-center justify-between">
          <ModalStake stake={stake} setStake={setStake} disabled={running} />
          <div className="text-sm text-amber-200">{running ? "Round live" : `Next round in ${countdown}...`}</div>
        </div>
        <EnginePanel engine={engine} />
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
  const engine = useGameEngine("Turbo");
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
      engine.finish(-stake, "Mine hit");
      settle("Mines", -stake);
      setActive(false);
    } else {
      setRevealed((items) => [...items, index]);
    }
  };
  const cashOut = () => {
    const profit = payout(stake, multiplier) - stake;
    setResult(`Cashed out ${multiplier}x. Won +${currency.format(profit)}.`);
    engine.finish(profit, `Safe cash ${multiplier}x`);
    settle("Mines cash out", profit);
    setActive(false);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="rounded-md border border-blue-300/20 bg-blue-950/40 p-4">
        <ModalStake stake={stake} setStake={setStake} disabled={active} />
        <EnginePanel engine={engine} />
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

function DoubleModalGame({ game, balance, settle }: { game: string; balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const engine = useGameEngine("Turbo");
  const [choice, setChoice] = useState<"Red" | "Black">("Red");
  const [spinning, setSpinning] = useState(false);
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState("");
  const spin = () => {
    if (stake > balance || spinning) return;
    setSpinning(true);
    setResult("");
    setTick(0);
    let frames = 0;
    const timer = window.setInterval(() => {
      frames += 1;
      setTick((value) => value + 1);
      if (frames >= 18) {
        window.clearInterval(timer);
        const landed: "Red" | "Black" = engine.didWin(0.5) ? choice : choice === "Red" ? "Black" : "Red";
        const won = landed === choice;
        setTick(landed === "Red" ? 0 : 1);
        setSpinning(false);
        setResult(`${landed} landed. ${won ? `Won +${currency.format(stake)}` : `Lost ${currency.format(stake)}`}.`);
        engine.finish(won ? stake : -stake, `${landed} landed`);
        settle(game, won ? stake : -stake);
      }
    }, 110);
  };
  const visibleColor = tick % 2 === 0 ? "Red" : "Black";
  return (
    <div className="rounded-md bg-[radial-gradient(circle_at_center,_#1f2937,_#111827_55%,_#020617)] p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={spinning} />
      <EnginePanel engine={engine} />
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="relative flex h-96 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/35">
          <div className={clsx("absolute h-72 w-72 rounded-full border-[18px] shadow-[0_0_60px_rgba(250,204,21,.2)] transition-transform duration-100", spinning && "animate-spin", visibleColor === "Red" ? "border-red-500 bg-red-950" : "border-zinc-200 bg-zinc-950")} />
          <div className="absolute h-20 w-2 rounded bg-amber-300 shadow-[0_0_20px_rgba(251,191,36,.8)]" />
          <div className={clsx("z-10 rounded-md px-5 py-3 text-5xl font-black", visibleColor === "Red" ? "bg-red-500 text-white" : "bg-white text-black")}>{visibleColor}</div>
        </div>
        <div className="rounded-md border border-white/10 bg-white/[0.04] p-4">
          <div className="text-xs uppercase text-slate-400">Pick a side</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["Red", "Black"] as const).map((item) => (
              <button key={item} disabled={spinning} onClick={() => setChoice(item)} className={clsx("rounded-md py-4 font-black", choice === item ? "bg-amber-300 text-black" : item === "Red" ? "bg-red-600 text-white" : "bg-zinc-100 text-black")}>{item}</button>
            ))}
          </div>
          <div className="mt-4 rounded-md bg-black/25 p-3 text-sm text-slate-300">Correct pick pays 2x. The wheel cycles before revealing the final color.</div>
          <button disabled={spinning || stake > balance} onClick={spin} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">{spinning ? "Spinning..." : `Spin ${choice}`}</button>
          <ResultBanner result={result} />
        </div>
      </div>
    </div>
  );
}

function PlinkoModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const engine = useGameEngine("Turbo");
  const [risk, setRisk] = useState("Medium");
  const [path, setPath] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [dropping, setDropping] = useState(false);
  const [result, setResult] = useState("");
  const multipliers = risk === "High" ? [15, 5, 2, 0.3, 0.2, 0.3, 2, 5, 15] : risk === "Low" ? [2, 1.4, 1.1, 0.8, 0.5, 0.8, 1.1, 1.4, 2] : [10, 3, 1.5, 0.5, 0.2, 0.5, 1.5, 3, 10];
  const drop = () => {
    if (dropping || stake > balance) return;
    const chance = risk === "High" ? 0.28 : risk === "Low" ? 0.52 : 0.38;
    const win = engine.didWin(chance);
    const targetBuckets = win ? [0, 1, 2, 6, 7, 8] : [3, 4, 5];
    const finalBucket = targetBuckets[Math.floor(Math.random() * targetBuckets.length)];
    let position = 4;
    const steps = Array.from({ length: 8 }, (_, index) => {
      const remaining = 8 - index;
      const direction = finalBucket > position ? 1 : finalBucket < position ? -1 : Math.random() > 0.5 ? 1 : -1;
      position += Math.random() < 1 / Math.max(1, remaining) ? direction : Math.random() > 0.5 ? 1 : -1;
      position = Math.max(0, Math.min(8, position));
      return position;
    });
    steps[steps.length - 1] = finalBucket;
    const fullPath = [4, ...steps];
    setPath(fullPath);
    setStep(0);
    setDropping(true);
    setResult("");
    const multi = multipliers[finalBucket];
    const profit = payout(stake, multi) - stake;
    let current = 0;
    const timer = window.setInterval(() => {
      current += 1;
      setStep(current);
      if (current >= fullPath.length - 1) {
        window.clearInterval(timer);
        window.setTimeout(() => {
          setDropping(false);
          setResult(`${multi}x bucket. ${profit >= 0 ? `Won +${currency.format(profit)}` : `Lost ${currency.format(Math.abs(profit))}`}.`);
          engine.finish(profit, `${risk} bucket ${multi}x`);
          settle("Plinko", profit);
        }, 260);
      }
    }, 180);
  };
  const ballPosition = path[step] ?? 4;
  return (
    <div className="rounded-md bg-slate-950 p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><ModalStake stake={stake} setStake={setStake} disabled={dropping} /><Select value={risk} setValue={setRisk} options={["Low", "Medium", "High"]} /></div>
      <EnginePanel engine={engine} />
      <div className="relative mx-auto h-96 max-w-3xl rounded-md bg-black/40 p-4">
        {Array.from({ length: 8 }, (_, row) => <div key={row} className="flex justify-center gap-8 py-2">{Array.from({ length: row + 3 }, (_, peg) => <span key={peg} className="h-3 w-3 rounded-full bg-emerald-300" />)}</div>)}
        {path.length > 0 && <div className="absolute h-6 w-6 rounded-full bg-amber-300 shadow-[0_0_24px_rgba(251,191,36,.9)] transition-all duration-200" style={{ left: `${10 + ballPosition * 9}%`, top: `${12 + step * 8}%` }} />}
        <div className="absolute bottom-3 left-3 right-3 grid grid-cols-9 gap-1">{multipliers.map((multi, index) => <div key={index} className="rounded bg-emerald-400/20 py-3 text-center text-sm font-black">{multi}x</div>)}</div>
      </div>
      <button disabled={dropping || stake > balance} onClick={drop} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">{dropping ? "Ball dropping..." : "Drop Ball"}</button>
      <ResultBanner result={result} />
    </div>
  );
}

function LimboModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const engine = useGameEngine("Turbo");
  const [target, setTarget] = useState(2);
  const [display, setDisplay] = useState(1);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const play = () => {
    if (running || stake > balance) return;
    const winChance = 1 / Math.max(1.1, target);
    const won = engine.didWin(winChance);
    const variance = engine.profile.variance;
    const final = won
      ? Number((target + Math.random() * Math.max(0.25, target * 0.65 * variance)).toFixed(2))
      : Number((1 + Math.random() * Math.max(0.05, target - 1)).toFixed(2));
    const profit = won ? payout(stake, target) - stake : -stake;
    setDisplay(1);
    setRunning(true);
    setResult("");
    let frames = 0;
    const timer = window.setInterval(() => {
      frames += 1;
      setDisplay((value) => Number(Math.min(final, value + Math.max(0.05, final / 24)).toFixed(2)));
      if (frames >= 26) {
        window.clearInterval(timer);
        setDisplay(final);
        setRunning(false);
        setResult(`${final}x result. ${won ? `Cleared ${target}x and won +${currency.format(profit)}` : `Missed ${target}x and lost ${currency.format(stake)}`}.`);
        engine.finish(profit, `${final}x reveal`);
        settle("Limbo", profit);
      }
    }, 70);
  };
  return (
    <div className="rounded-md bg-[linear-gradient(135deg,_#082f49,_#111827)] p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ModalStake stake={stake} setStake={setStake} disabled={running} />
        <label className="min-w-48 text-xs uppercase text-slate-400">
          Target multiplier
          <input disabled={running} type="number" min={1.1} max={10} step={0.1} value={target} onChange={(event) => setTarget(Number(event.target.value))} className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3 text-base text-white" />
        </label>
      </div>
      <EnginePanel engine={engine} />
      <div className="relative mt-6 h-80 overflow-hidden rounded-md border border-sky-300/20 bg-black/35">
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-[linear-gradient(180deg,_transparent,_rgba(14,165,233,.12))]" />
        <div className="absolute left-6 right-6 top-1/2 h-px bg-amber-300/60" />
        <div className="absolute left-8 top-[calc(50%-28px)] rounded bg-amber-300 px-2 py-1 text-xs font-black text-black">Target {target.toFixed(2)}x</div>
        <div className="absolute text-5xl transition-all duration-100" style={{ left: `${Math.min(84, 8 + display * 7)}%`, bottom: `${Math.min(76, 8 + display * 7)}%` }}>↗</div>
        <div className={clsx("absolute inset-0 flex items-center justify-center text-7xl font-black", running ? "text-sky-200" : display >= target ? "text-emerald-300" : "text-red-300")}>{display.toFixed(2)}x</div>
      </div>
      <button disabled={running || stake > balance} onClick={play} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">{running ? "Climbing..." : "Start Limbo"}</button>
      <ResultBanner result={result} />
    </div>
  );
}

function DiceModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const engine = useGameEngine("Turbo");
  const [target, setTarget] = useState(50);
  const [mode, setMode] = useState("over");
  const [rollValue, setRollValue] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState("");
  const chance = mode === "over" ? 100 - target : target;
  const multi = Number(((100 - engine.profile.edge * 100) / Math.max(1, chance)).toFixed(2));
  const roll = () => {
    if (rolling || stake > balance) return;
    const win = engine.didWin(chance / 100);
    const value = win
      ? mode === "over"
        ? Math.min(100, target + 1 + Math.floor(Math.random() * Math.max(1, 100 - target)))
        : Math.max(1, Math.floor(Math.random() * Math.max(1, target)))
      : mode === "over"
        ? Math.max(1, Math.floor(Math.random() * Math.max(1, target + 1)))
        : Math.min(100, target + Math.floor(Math.random() * Math.max(1, 101 - target)));
    setRolling(true);
    setResult("");
    let frames = 0;
    const timer = window.setInterval(() => {
      frames += 1;
      setRollValue(Math.floor(Math.random() * 100) + 1);
      if (frames >= 14) {
        window.clearInterval(timer);
        setRollValue(value);
        setRolling(false);
        const amount = win ? payout(stake, multi) - stake : -stake;
        setResult(`${value} rolled. ${win ? `Won +${currency.format(amount)}` : `Lost ${currency.format(stake)}`}.`);
        engine.finish(amount, `${mode} ${target} rolled ${value}`);
        settle("Dice", amount);
      }
    }, 70);
  };
  return (
    <div className="rounded-md bg-[linear-gradient(135deg,_#111827,_#064e3b)] p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={rolling} />
      <EnginePanel engine={engine} />
      <div className={clsx("mt-6 flex h-48 items-center justify-center rounded-md bg-black/30 text-7xl font-black text-white transition", rolling && "animate-pulse")}>{rollValue ?? "?"}</div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Select value={mode} setValue={setMode} options={["over", "under"]} />
        <div className="text-sm text-slate-200">Win chance {chance}% - Payout {multi}x</div>
      </div>
      <input disabled={rolling} type="range" min="1" max="99" value={target} onChange={(event) => setTarget(Number(event.target.value))} className="mt-4 w-full accent-emerald-400" />
      <button disabled={rolling || stake > balance} onClick={roll} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">{rolling ? "Rolling..." : `Roll ${mode} ${target}`}</button>
      <ResultBanner result={result} />
    </div>
  );
}

function HiLoModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const engine = useGameEngine("Turbo");
  const [card, setCard] = useState(7);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState("");
  const multi = Number((1 + streak * 0.55).toFixed(2));
  const guess = (dir: "Higher" | "Lower") => {
    const rawChance = dir === "Higher" ? (13 - card) / 13 : (card - 1) / 13;
    const win = rawChance > 0 && engine.didWin(rawChance);
    const next = win
      ? dir === "Higher"
        ? card + 1 + Math.floor(Math.random() * Math.max(1, 13 - card))
        : 1 + Math.floor(Math.random() * Math.max(1, card - 1))
      : dir === "Higher"
        ? 1 + Math.floor(Math.random() * Math.max(1, card))
        : card + Math.floor(Math.random() * Math.max(1, 14 - card));
    setCard(next);
    if (win) {
      setStreak((value) => value + 1);
      setResult(`${dir} correct. Streak ${streak + 1}.`);
      engine.finish(1, `${dir} streak ${streak + 1}`);
    } else {
      setResult(`${dir} missed. Lost ${currency.format(stake)}.`);
      engine.finish(-stake, `${dir} missed`);
      settle("HiLo", -stake);
      setStreak(0);
    }
  };
  const cash = () => {
    const profit = payout(stake, multi) - stake;
    setResult(`Cashed streak ${streak}. Won +${currency.format(profit)}.`);
    engine.finish(profit, `Streak cash ${multi}x`);
    settle("HiLo cash out", profit);
    setStreak(0);
  };
  return (
    <div className="rounded-md bg-purple-950/40 p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={streak > 0} />
      <EnginePanel engine={engine} />
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
  const engine = useGameEngine(game.includes("American") ? "Wild" : "Turbo");
  const [bets, setBets] = useState<number[]>([]);
  const [outsideBets, setOutsideBets] = useState<string[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [winning, setWinning] = useState<number | null>(null);
  const [resultText, setResultText] = useState("");
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
    setResultText("");
    window.setTimeout(() => {
      const result = numbers[Math.floor(Math.random() * numbers.length)];
      setWinning(result);
      setSpinning(false);
      const straightNet = bets.reduce((sum, number) => sum + (number === result ? stake * 35 : -stake), 0);
      const outsideNet = outsideBets.reduce((sum, label) => sum + (outsideBetWon(label, result) ? stake : -stake), 0);
      const total = straightNet + outsideNet;
      setResultText(`${result} hit. ${total >= 0 ? `Won +${currency.format(total)}` : `Lost ${currency.format(Math.abs(total))}`}.`);
      engine.finish(total, `Roulette ${result}`);
      settle(game, total);
    }, 3000);
  };
  return (
    <div className="rounded-md bg-green-950 p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={spinning} />
      <EnginePanel engine={engine} />
      <div className="mx-auto mt-6 flex h-64 w-64 items-center justify-center rounded-full border-[18px] border-red-900 bg-black shadow-2xl">
        <div className={clsx("flex h-44 w-44 items-center justify-center rounded-full border-8 border-amber-200 bg-green-800 text-5xl font-black", spinning && "animate-spin")}>{winning ?? "●"}</div>
      </div>
      <div className="mt-6 grid grid-cols-6 gap-1 md:grid-cols-12">
        {numbers.map((number) => <button key={number} onClick={() => setBets((items) => items.includes(number) ? items.filter((item) => item !== number) : [...items, number])} className={clsx("relative rounded py-3 text-sm font-black", number === 0 ? "bg-emerald-500 text-black" : number % 2 ? "bg-red-700" : "bg-zinc-900", bets.includes(number) && "ring-2 ring-amber-300")}>{number}{bets.includes(number) && <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-amber-300" />}</button>)}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">{["Red", "Black", "Odd", "Even"].map((item) => <button key={item} onClick={() => toggleOutsideBet(item)} className={clsx("rounded py-2 text-sm font-bold", outsideBets.includes(item) ? "bg-amber-300 text-black" : "bg-white/10")}>{item}</button>)}</div>
      <button disabled={spinning || totalBets === 0 || stake * totalBets > balance} onClick={spin} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">Spin</button>
      <ResultBanner result={resultText} />
    </div>
  );
}

function BlackjackModalGame({ balance, settle }: { balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const engine = useGameEngine("Chill");
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
    if (!push) {
      engine.finish(win ? stake : -stake, win ? "Dealer beaten" : "Dealer wins");
      settle("Blackjack", win ? stake : -stake);
    } else {
      engine.finish(0, "Push");
    }
    setActive(false);
  };
  return (
    <div className="rounded-md bg-[radial-gradient(circle,_#166534,_#052e16)] p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={active} />
      <EnginePanel engine={engine} />
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
  const engine = useGameEngine("Wild");
  const symbols = game.includes("Soccer") ? ["⚽", "🥅", "🏆", "⭐", "🇧🇷"] : game.includes("Space") ? ["🚀", "🪐", "⭐", "🌙", "☄"] : game.includes("Fruit") ? ["🍒", "🍋", "🍇", "🍉", "7"] : ["💎", "👑", "7", "BAR", "★"];
  const [reels, setReels] = useState(["7", "💎", "👑", "BAR", "★"]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState("");
  const spin = () => {
    setSpinning(true);
    setResult("");
    const hit = engine.didWin(0.28);
    const bonus = engine.bonusBoost();
    const mainSymbol = symbols[Math.floor(Math.random() * symbols.length)];
    const final = hit
      ? Array.from({ length: 5 }, (_, index) => (index < (bonus.multiplier > 1 ? 4 : 3) ? mainSymbol : symbols[Math.floor(Math.random() * symbols.length)]))
      : Array.from({ length: 5 }, (_, index) => symbols[(index + Math.floor(Math.random() * symbols.length)) % symbols.length]);
    window.setTimeout(() => {
      setReels(final);
      setSpinning(false);
      const counts = final.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item]: (acc[item] ?? 0) + 1 }), {});
      const best = Math.max(...Object.values(counts));
      const amount = best >= 4 ? payout(stake, 8 * bonus.multiplier) - stake : best >= 3 ? payout(stake, 2 * bonus.multiplier) - stake : -stake;
      setResult(amount >= 0 ? `Payline hit. ${bonus.label}. Won +${currency.format(amount)}` : `No line. Lost ${currency.format(stake)}`);
      engine.finish(amount, best >= 4 ? "Mega line" : best >= 3 ? "Line hit" : "No line");
      settle(game, amount);
    }, 1100);
  };
  return (
    <div className="rounded-md bg-[linear-gradient(135deg,_#4c0519,_#78350f,_#111827)] p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={spinning} />
      <EnginePanel engine={engine} />
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
  const engine = useGameEngine("Turbo");
  const [keeper, setKeeper] = useState<number | null>(null);
  const [shot, setShot] = useState<number | null>(null);
  const [charging, setCharging] = useState(false);
  const zones = Array.from({ length: 9 }, (_, index) => index);
  const shoot = (zone: number) => {
    if (charging || stake > balance) return;
    setCharging(true);
    setShot(zone);
    setKeeper(null);
    window.setTimeout(() => {
      const win = engine.didWin(0.72);
      const defend = win ? zones.filter((item) => item !== zone)[Math.floor(Math.random() * 8)] : zone;
      setKeeper(defend);
      setCharging(false);
      engine.finish(win ? stake : -stake, win ? "Goal" : "Saved");
      settle(game, win ? stake : -stake);
    }, 650);
  };
  return (
    <div className="rounded-md bg-[linear-gradient(180deg,_#064e3b,_#14532d)] p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={charging} />
      <EnginePanel engine={engine} />
      <div className="mx-auto mt-6 max-w-2xl rounded-md border-8 border-white p-3">
        <div className="grid grid-cols-3 gap-2">
          {zones.map((zone) => <button disabled={charging || stake > balance} key={zone} onClick={() => shoot(zone)} className={clsx("h-28 rounded bg-emerald-900/80 text-2xl font-black transition", charging && shot === zone && "animate-pulse bg-amber-300 text-black", shot === zone && !charging && "bg-amber-300 text-black", keeper === zone && "bg-red-500 text-white")}>{keeper === zone ? "GK" : shot === zone ? "●" : ""}</button>)}
        </div>
      </div>
      <div className="mt-4 text-center text-sm text-slate-200">{charging ? "Charging shot..." : shot === null ? "Pick a target zone." : shot === keeper ? "Saved." : "Goal."}</div>
    </div>
  );
}

function MapModalGame({ game, balance, settle }: { game: string; balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const engine = useGameEngine("Chill");
  const [result, setResult] = useState("");
  const [pin, setPin] = useState({ left: 50, top: 50 });
  const [spinning, setSpinning] = useState(false);
  const cities = ["New York", "São Paulo", "Tokyo", "Paris", "Cairo", "Sydney", "Toronto"];
  const play = () => {
    if (spinning || stake > balance) return;
    setSpinning(true);
    setResult("");
    const city = cities[Math.floor(Math.random() * cities.length)];
    const timer = window.setInterval(() => setPin({ left: 12 + Math.random() * 76, top: 14 + Math.random() * 72 }), 90);
    window.setTimeout(() => {
      window.clearInterval(timer);
      const win = engine.didWin(0.55);
      const amount = win ? stake : -stake;
      setPin({ left: 12 + Math.random() * 76, top: 14 + Math.random() * 72 });
      setResult(`${game}: ${city}. ${win ? `Won +${currency.format(amount)}` : `Lost ${currency.format(stake)}`}.`);
      setSpinning(false);
      engine.finish(amount, city);
      settle(game, amount);
    }, 900);
  };
  return (
    <div className="rounded-md bg-slate-100 p-5 text-slate-950">
      <ModalStake stake={stake} setStake={setStake} disabled={spinning} />
      <div className="text-white"><EnginePanel engine={engine} /></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative h-96 overflow-hidden rounded-md border border-slate-300 bg-[linear-gradient(135deg,_#bfdbfe,_#dcfce7)]">
          <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
          <div className={clsx("absolute rounded-full bg-red-500 px-3 py-2 font-black text-white shadow-xl transition-all duration-100", spinning && "animate-bounce")} style={{ left: `${pin.left}%`, top: `${pin.top}%` }}>PIN</div>
        </div>
        <div className="rounded-md bg-white p-4 shadow">
          <h3 className="font-black">{game}</h3>
          <p className="mt-2 text-sm text-slate-600">Map challenge powered by OpenStreetMap-ready layout. Add Leaflet tiles for production map controls.</p>
          <button disabled={spinning || stake > balance} onClick={play} className="mt-4 w-full rounded-md bg-emerald-500 py-3 font-black text-black disabled:opacity-40">{spinning ? "Dropping..." : "Play Map Round"}</button>
          <ResultBanner result={result} />
        </div>
      </div>
    </div>
  );
}

function InstantModalGame({ game, balance, settle }: { game: string; balance: number; settle: (label: string, amount: number) => void }) {
  const [stake, setStake] = useState(25);
  const engine = useGameEngine("Turbo");
  const [result, setResult] = useState("");
  const [revealed, setRevealed] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const play = () => {
    if (playing || stake > balance) return;
    const hit = engine.didWin(0.36);
    const bonus = engine.bonusBoost();
    const multiplier = hit ? [1.5, 2, 3, 5][Math.floor(Math.random() * 4)] * bonus.multiplier : [0, 0.25, 0.5][Math.floor(Math.random() * 3)];
    const amount = payout(stake, multiplier) - stake;
    setPlaying(true);
    setRevealed([]);
    setResult("");
    let index = 0;
    const timer = window.setInterval(() => {
      setRevealed((items) => [...items, index]);
      index += 1;
      if (index >= 9) {
        window.clearInterval(timer);
        window.setTimeout(() => {
          setPlaying(false);
          setResult(multiplier > 1 ? `${multiplier.toFixed(2)}x. ${bonus.label}. Won +${currency.format(amount)}.` : `Result ${multiplier}x. Lost ${currency.format(Math.abs(amount))}.`);
          engine.finish(amount, multiplier > 1 ? "Instant hit" : "Instant miss");
          settle(game, amount);
        }, 250);
      }
    }, 90);
  };
  return (
    <div className="rounded-md bg-[linear-gradient(135deg,_#111827,_#312e81)] p-5">
      <ModalStake stake={stake} setStake={setStake} disabled={playing} />
      <EnginePanel engine={engine} />
      <div className="mt-6 grid grid-cols-3 gap-3">
        {Array.from({ length: 9 }, (_, index) => {
          const isOpen = revealed.includes(index);
          return <div key={index} className={clsx("flex h-24 items-center justify-center rounded-md text-3xl font-black transition-all duration-200", isOpen ? "scale-105 bg-amber-300 text-black" : "bg-white/10 text-amber-200", playing && !isOpen && "animate-pulse")}>{isOpen ? ["★", "$", "7", "◆", "✓"][index % 5] : "?"}</div>;
        })}
      </div>
      <button disabled={playing || stake > balance} onClick={play} className="mt-4 w-full rounded-md bg-emerald-400 py-3 font-black text-black disabled:opacity-40">{playing ? "Revealing..." : `Play ${game}`}</button>
      <ResultBanner result={result} />
    </div>
  );
}

function Select({ value, setValue, options }: { value: string; setValue: (value: string) => void; options: string[] }) {
  return <select value={value} onChange={(event) => setValue(event.target.value)} className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2">{options.map((option) => <option key={option}>{option}</option>)}</select>;
}

function WalletView({ user, balance, claimBonus, transactions, onDeposit, onLock, riskSignals }: { user: AppUser | null; balance: number; claimBonus: () => void; transactions: Transaction[]; onDeposit: () => void; onLock: () => void; riskSignals: RiskSignals }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-5">
          <Wallet className="mb-3 h-8 w-8 text-amber-300" />
          <div className="text-sm uppercase text-amber-100">Balance</div>
          <div className="text-5xl font-black text-white">{currency.format(balance)}</div>
          <button onClick={onDeposit} className="mt-5 w-full rounded-md bg-emerald-400 py-3 font-black text-black">Deposit</button>
          <button onClick={claimBonus} className="mt-2 w-full rounded-md border border-white/10 bg-black/25 py-3 font-black text-white">Claim daily bonus</button>
        </div>
        <ResponsibleGamingPanel user={user} onLock={onLock} riskSignals={riskSignals} />
      </div>
      <TransactionList transactions={transactions} />
      <Leaderboard user={user} balance={balance} />
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

function ProfileView({ user, setUser, balance, bets, winCount, lossCount, onLock, riskSignals, settleBet, cashOutBet, cashOutValue }: { user: AppUser | null; setUser: (user: AppUser | null) => void; balance: number; bets: Bet[]; winCount: number; lossCount: number; onLock: () => void; riskSignals: RiskSignals; settleBet: (id: string) => void; cashOutBet: (id: string) => void; cashOutValue: (bet: Bet) => number | null }) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const decidedBets = winCount + lossCount;
  const winRate = decidedBets ? `${Math.round((winCount / decidedBets) * 100)}%` : "0%";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = (email || user?.email || "player@henriquinhobets.local").trim().toLowerCase();
    setUser({ name: name || "Henrique", email: normalizedEmail, admin: user?.admin, guest: user?.guest });
  };
  return (
    <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <form onSubmit={submit} className="rounded-md border border-white/10 bg-[#0b1210] p-4">
          <LogIn className="mb-3 h-7 w-7 text-emerald-300" />
          <h2 className="font-black text-white">Supabase Auth ready</h2>
          <p className="mt-1 text-sm text-slate-400">Add Supabase keys to enable hosted registration, login, password reset, and isolated account data.</p>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className="mt-4 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3" />
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="mt-2 w-full rounded-md border border-white/10 bg-black/30 px-3 py-3" />
          <button className="mt-3 w-full rounded-md bg-emerald-400 py-3 font-black text-black">Register / login</button>
        </form>
        <ResponsibleGamingPanel user={user} onLock={onLock} riskSignals={riskSignals} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Balance" value={currency.format(balance)} />
        <Stat label="Wins" value={String(winCount)} />
        <Stat label="Losses" value={String(lossCount)} />
        <Stat label="Win rate" value={winRate} />
        <div className="sm:col-span-4">
          {user?.guest ? (
            <div className="rounded-md border border-amber-300/20 bg-[#0b1210] p-4 text-sm text-amber-100">Guest mode keeps gameplay temporary, so bet history is hidden until you use a beta account.</div>
          ) : (
            <BetHistory bets={bets} settleBet={settleBet} cashOutBet={cashOutBet} cashOutValue={cashOutValue} />
          )}
        </div>
      </div>
      <Leaderboard user={user} balance={balance} />
    </section>
  );
}

function AdminView({ bets, transactions, lockedAccounts, unlockAccount }: { bets: Bet[]; transactions: Transaction[]; lockedAccounts: LockedAccount[]; unlockAccount: (email: string) => void }) {
  const totalVolume = transactions.reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const gameCounts = transactions
    .filter((item) => item.type === "casino_win" || item.type === "casino_loss")
    .reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.label.split(" ")[0]]: (acc[item.label.split(" ")[0]] ?? 0) + 1 }), {});
  const mostPlayed = Object.entries(gameCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "No rounds yet";
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
          {["Live event feeds", "Realtime odds feed", "Supabase realtime wallet"].map((item) => <div key={item} className="rounded-md bg-emerald-400/10 p-4 text-emerald-100"><Crown className="mb-2 h-5 w-5" />{item}<div className="mt-1 text-xs text-slate-400">Ready for production</div></div>)}
        </div>
      </div>
      <div className="rounded-md border border-white/10 bg-[#0b1210] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-black text-white">Locked accounts</h2>
          <span className="rounded bg-red-500/10 px-2 py-1 text-xs font-bold text-red-100">{lockedAccounts.length} locked</span>
        </div>
        <div className="space-y-2">
          {lockedAccounts.length === 0 && <div className="rounded-md bg-white/[0.04] p-3 text-sm text-slate-400">No locked beta accounts right now.</div>}
          {lockedAccounts.map((account) => (
            <div key={`${account.email}-${account.lockedAt}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white/[0.04] px-3 py-3 text-sm">
              <div>
                <div className="font-black text-white">{account.name}</div>
                <div className="text-xs text-slate-400">{account.email} - {new Date(account.lockedAt).toLocaleString()}</div>
                <div className="text-xs text-amber-200">{account.reason}</div>
              </div>
              <button onClick={() => unlockAccount(account.email)} className="rounded-md bg-emerald-400 px-3 py-2 text-xs font-black text-black">Unlock</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-white/10 bg-[#0b1210] p-4"><div className="text-xs uppercase text-slate-400">{label}</div><div className="mt-1 text-2xl font-black text-white">{value}</div></div>;
}

function ResponsibleGamingPanel({ user, onLock, riskSignals }: { user: AppUser | null; onLock: () => void; riskSignals: RiskSignals }) {
  const [confirmStep, setConfirmStep] = useState(0);
  const elevated = riskSignals.level === "Elevated";
  const adminProtected = Boolean(user?.admin);
  const lockCopy = confirmStep === 0
    ? "Lock my access"
    : confirmStep === 1
      ? "Warning 1: continue to final confirmation"
      : "Warning 2: lock this account/device now";
  const requestLock = () => {
    if (adminProtected) return;
    if (confirmStep < 2) {
      setConfirmStep((step) => step + 1);
      return;
    }
    onLock();
  };
  return (
    <div className={clsx("rounded-md border p-4", elevated ? "border-amber-300/30 bg-amber-300/10" : "border-white/10 bg-[#0b1210]")}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-black text-white">Play protection</h2>
        <span className={clsx("rounded px-2 py-1 text-xs font-bold", elevated ? "bg-amber-300 text-black" : "bg-emerald-400/10 text-emerald-200")}>{riskSignals.level}</span>
      </div>
      <p className="mt-2 text-sm text-slate-300">
        This beta tracks warning signs like repeated losses, repeat deposits, and large virtual-coin swings. If it stops feeling fun, lock access now.
      </p>
      <div className="mt-3 grid gap-2 text-xs text-slate-400">
        <div>Casino losses: {riskSignals.casinoLosses}</div>
        <div>Deposits: {riskSignals.depositCount}</div>
        <div>Loss volume: {currency.format(riskSignals.recentLossVolume)}</div>
      </div>
      <div className="mt-3 rounded-md bg-white/[0.04] p-3 text-xs text-slate-300">
        <div className="font-black text-white">Support resources</div>
        <div className="mt-2 grid gap-1">
          <span>Take a 24-hour break before continuing.</span>
          <span>Tell someone you trust and ask them to sit with you.</span>
          <span>Use device/app blockers if you need distance.</span>
          <span>US: call or text 988 for crisis support.</span>
          <span>US gambling help: 1-800-GAMBLER.</span>
          <span>Brazil CVV: 188. Portugal SNS 24: 808 24 24 24.</span>
          <span>Virtual coins only; never chase losses.</span>
        </div>
      </div>
      {confirmStep > 0 && !adminProtected && (
        <div className="mt-3 rounded-md border border-red-300/20 bg-red-500/10 p-3 text-xs text-red-100">
          This is a self-exclusion lock. You will be signed out and blocked on this device until admin unlocks it or you email {supportEmail}.
        </div>
      )}
      {adminProtected ? (
        <div className="mt-3 rounded-md border border-emerald-300/20 bg-emerald-400/10 px-3 py-3 text-sm font-bold text-emerald-100">Admin accounts are protected and cannot be self-locked.</div>
      ) : (
        <div className="mt-3 grid gap-2">
          <button onClick={requestLock} className={clsx("w-full rounded-md px-3 py-3 font-black text-white", confirmStep < 2 ? "bg-amber-600" : "bg-red-500")}>{lockCopy}</button>
          {confirmStep > 0 && <button onClick={() => setConfirmStep(0)} className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200">Cancel lock request</button>}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">Locked accounts/devices must email {supportEmail} to request access again.</p>
    </div>
  );
}

function Leaderboard({ user, balance }: { user: AppUser | null; balance: number }) {
  const ranked = useMemo(
    () => [
      ...demoLeaderboard.map((player) => ({ ...player, demo: true })),
      { name: user?.name ?? "Guest", username: user?.guest ? "@guest" : "@you", balance, demo: false },
    ].sort((a, b) => b.balance - a.balance),
    [balance, user?.name],
  );
  return (
    <div className="rounded-md border border-white/10 bg-[#0b1210] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 font-black text-white"><Trophy className="h-5 w-5 text-amber-300" />Leaderboard</h2>
        <span className="rounded bg-amber-300/10 px-2 py-1 text-[10px] font-bold uppercase text-amber-200">Beta seed</span>
      </div>
      <div className="space-y-2">
        {ranked.slice(0, 7).map((player, index) => (
          <div key={`${player.name}-${player.demo}`} className={clsx("flex items-center justify-between rounded-md px-3 py-2 text-sm", player.demo ? "bg-white/[0.04]" : "bg-emerald-400/10 text-emerald-100")}>
            <div>
              <span className="mr-2 text-amber-200">#{index + 1}</span>{player.name}
              <div className="text-xs text-slate-400">{player.username} - {player.demo ? "Demo beta player" : "Current account"}</div>
            </div>
            <b>{currency.format(player.balance)}</b>
          </div>
        ))}
        <div className="rounded-md bg-white/[0.04] px-3 py-3 text-xs text-slate-400">Demo rows keep the beta populated until Supabase has enough real users.</div>
      </div>
    </div>
  );
}

function BetHistory({ bets, settleBet, cashOutBet, cashOutValue }: { bets: Bet[]; settleBet: (id: string) => void; cashOutBet: (id: string) => void; cashOutValue: (bet: Bet) => number | null }) {
  return (
    <div className="rounded-md border border-white/10 bg-[#0b1210] p-4">
      <h2 className="mb-3 font-black text-white">Bet history</h2>
      <div className="space-y-2">
        {bets.length === 0 && <div className="rounded-md bg-white/[0.04] p-3 text-sm text-slate-400">No bets placed yet.</div>}
        {bets.map((bet) => {
          const offer = cashOutValue(bet);
          return (
            <div key={bet.id} className="rounded-md bg-white/[0.04] p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <b>{bet.picks.length > 1 ? "Parlay" : "Single"} - {currency.format(bet.stake)}</b>
                <span className={clsx("rounded px-2 py-1 text-xs", bet.status === "won" ? "bg-emerald-400/20 text-emerald-200" : bet.status === "lost" ? "bg-red-400/20 text-red-200" : bet.status === "cashed_out" ? "bg-sky-400/20 text-sky-200" : "bg-amber-300/20 text-amber-100")}>{bet.status.replace("_", " ")}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">{bet.picks.map((pick) => `${pick.label} @ ${compact.format(pick.odds)}`).join(" + ")}</div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>{bet.status === "cashed_out" ? `Cashed out ${currency.format(bet.cashOut ?? 0)}` : `To win ${currency.format(bet.potentialWin)}`}</span>
                {bet.status === "open" && (
                  <div className="flex gap-2">
                    {offer && <button onClick={() => cashOutBet(bet.id)} className="rounded bg-sky-300 px-2 py-1 font-black text-black">Cash out {currency.format(offer)}</button>}
                    <button onClick={() => settleBet(bet.id)} className="rounded bg-emerald-400 px-2 py-1 font-bold text-black">Settle</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
