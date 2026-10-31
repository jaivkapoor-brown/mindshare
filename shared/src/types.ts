export type TraitKind = "identity" | "loves" | "hates" | "quirk";

export interface Trait {
  id: string;
  text: string;
  clue_text: string;
  keywords: string[];
}

export interface Persona {
  name: string;
  voice: string;
  identity: Trait;
  loves: Trait;
  hates: Trait;
  quirk: Trait;
  custom?: boolean;
  description?: string;
}

export interface Clue {
  kind: TraitKind;
  text: string; // "The judge ..."
}

export type Phase =
  | "LOBBY"
  | "SETUP"
  | "CLUE"
  | "WRITE"
  | "MARKET"
  | "VERDICT"
  | "REVEAL"
  | "SCOREBOARD"
  | "GAME_OVER";

export type Mood = "neutral" | "smug" | "grumpy" | "delighted";

export interface RoomConfig {
  rounds: number;
  insider: boolean;
  tutorial: boolean;
  customJudge?: string;
}

export interface PublicSeat {
  id: string;
  nick: string;
  isBot: boolean;
  connected: boolean;
  away: boolean;
  submitted: boolean;
  acked: boolean;
  score: number;
  royalties: number;
  joinedAt: number;
}

export interface Ticker {
  ticker: string;
  text: string;
}

export interface RevealTicker extends Ticker {
  authors: { seatId: string; nick: string; isBot: boolean }[];
  isDecoy: boolean;
}

export interface PnlRow {
  seatId: string;
  nick: string;
  isBot: boolean;
  holdings: number[];
  spent: number;
  payout: number;
  royalty: number;
  crowd: number;
  roundScore: number; // after weighting
  insider: boolean;
}

export interface AudiencePnlRow {
  id: string;
  nick: string;
  net: number;
}

export interface RevealData {
  round: number;
  persona: Persona;
  seed: string;
  commit: string;
  winner: string;
  runnerUp: string | null;
  reason: string;
  fallback: boolean;
  custom: boolean;
  prompt: string;
  tickers: RevealTicker[];
  noAnswer: { seatId: string; nick: string; text: string }[];
  pnl: PnlRow[];
  priceHistory: { t: number; p: number[] }[];
  crowdPick: string | null;
  audience: AudiencePnlRow[];
  tutorial: boolean;
}

export interface Standing {
  seatId: string;
  nick: string;
  isBot: boolean;
  score: number;
  royalties: number;
  rounds: number[];
}

export interface InsiderResult {
  round: number;
  insiderId: string;
  insiderNick: string;
  caught: boolean;
}

export interface PublicState {
  code: string;
  phase: Phase;
  phaseEndsAt: number | null;
  now: number;
  round: number;
  totalRounds: number;
  tutorialRound: boolean;
  config: RoomConfig;
  gamesPlayed: number;
  hostId: string | null;
  seats: PublicSeat[];
  audienceCount: number;
  audience: AudiencePnlRow[];
  prompt: string | null;
  judgeName: string | null;
  commit: string | null;
  tickers: Ticker[];
  q: number[];
  b: number;
  priceHistory: { t: number; p: number[] }[];
  tell: { text: string; mood: Mood } | null;
  reveal: RevealData | null;
  standings: Standing[];
  insiderResults: InsiderResult[] | null;
  insiderVotes: number;
  marketEndsAt: number | null;
}

export interface PrivateState {
  seatId: string | null;
  role: "player" | "audience";
  nick: string;
  clue: Clue | null;
  cash: number;
  holdings: number[];
  submitted: string | null;
  fullPersona: Persona | null;
  isInsider: boolean;
  crowdVote: string | null;
  insiderVote: string | null;
  notes: string[];
}
