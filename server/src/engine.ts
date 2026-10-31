import {
  ANSWER_MAX,
  AUDIENCE_B,
  AUDIENCE_CREDITS,
  AWAY_AFTER_MISSED_ROUNDS,
  B_LARGE,
  B_SMALL,
  B_SMALL_MAX_SEATS,
  BOT_BUY_MAX,
  BOT_BUY_MIN,
  BOT_NOISE_SIGMA,
  BOT_QUIET_FINAL_MS,
  BOT_TRADE_MAX_MS,
  BOT_TRADE_MIN_MS,
  BOT_WRITE_MAX_MS,
  BOT_WRITE_MIN_MS,
  CLUE_MS,
  COST_TOLERANCE,
  CREDITS_PER_ROUND,
  CROWD_BONUS,
  DECOY_BAIT_RATE,
  DECOY_SMALL_ROOM_MAX,
  DECOYS_LARGE_ROOM,
  DECOYS_SMALL_ROOM,
  DEFAULT_ROUNDS,
  FALLBACK_REASONS,
  INSIDER_MISS_BONUS,
  LLM_TIMEOUT_MODERATE_MS,
  LLM_TIMEOUT_VOICE_MS,
  MARKET_MS,
  MAX_PLAYERS,
  MAX_SHARES_PER_OUTCOME,
  MIN_SEATS,
  MIN_TICKERS,
  NICK_MAX,
  NICK_MIN,
  NO_ANSWER,
  PRICE_BROADCAST_MS,
  PROMPTS,
  REMOVED_ANSWER,
  REVEAL_EXTEND_MS,
  REVEAL_MS,
  ROOM_IDLE_MS,
  ROYALTY,
  SCOREBOARD_MS,
  SETUP_MS,
  SOLO_PAD_TO,
  TELL_AT_REMAINING_MS,
  TICKERS,
  TRADE_RATE_PER_SEC,
  TRAITS,
  TUTORIAL_WEIGHT,
  VERDICT_MAX_MS,
  VERDICT_MIN_MS,
  WRITE_MS,
  commitHash,
  decoysFor,
  keywordJudge,
  localFlag,
  lmsrPrices,
  makeRng,
  parseClientMessage,
  partialScore,
  randomHex,
  tradeCost,
} from "@mindshare/shared";
import type {
  AudiencePnlRow,
  Clue,
  ClientMessage,
  InsiderResult,
  Mood,
  Persona,
  Phase,
  PnlRow,
  PrivateState,
  PromptEntry,
  PublicState,
  RevealData,
  RoomConfig,
  ServerMessage,
  Standing,
  Trait,
  TraitKind,
} from "@mindshare/shared";
import type { CustomJudgeResult, Llm } from "./llm";

// ---------- persisted state ----------

export interface Seat {
  id: string;
  token: string;
  nick: string;
  isBot: boolean;
  connected: boolean;
  connectedSince: number;
  joinedAt: number;
  away: boolean;
  missedRounds: number;
  kicked: boolean;
  score: number;
  royalties: number;
  roundScores: number[];
}

export interface AudienceMember {
  id: string;
  token: string;
  nick: string;
  connected: boolean;
  wantsSeat: boolean;
  net: number;
  cash: number;
  holdings: number[];
  vote: string | null;
}

export interface InternalTicker {
  ticker: string;
  text: string;
  author: string | null;
  isDecoy: boolean;
}

export interface Answer {
  text: string;
  flagged: boolean;
  pendingUntil: number | null;
}

export interface RoundState {
  no: number;
  tutorial: boolean;
  prompt: PromptEntry;
  persona: Persona;
  voiceReady: boolean;
  seed: string;
  commit: string | null;
  setupStart: number;
  clues: Record<string, TraitKind>;
  acks: string[];
  tellKind: TraitKind;
  tellText: string | null;
  tell: { text: string; mood: Mood } | null;
  answers: Record<string, Answer>;
  notes: Record<string, string[]>;
  botSubmitAt: Record<string, number>;
  botAnswers: string[] | null;
  decoysLlm: string[] | null;
  tickers: InternalTicker[];
  q: number[];
  b: number;
  cash: Record<string, number>;
  holdings: Record<string, number[]>;
  traded: string[];
  priceHistory: { t: number; p: number[] }[];
  marketStart: number;
  marketEnd: number;
  botNext: Record<string, number>;
  botTrades: number;
  audQ: number[];
  verdictStart: number;
  verdict: { winner: string; runnerUp: string | null; reason: string; fallback: boolean } | null;
  reveal: RevealData | null;
  insiderId: string | null;
}

export interface RoomStateData {
  v: 1;
  code: string;
  created: number;
  closed: boolean;
  phase: Phase;
  phaseEndsAt: number | null;
  hostId: string | null;
  seats: Seat[];
  audience: AudienceMember[];
  config: RoomConfig;
  gamesPlayed: number;
  roundNo: number;
  round: RoundState | null;
  usedPrompts: number[];
  usedTraits: string[];
  lastActivity: number;
  examples: string[];
  insiderHistory: { round: number; insiderId: string }[];
  insiderVotes: Record<string, string>;
  insiderResults: InsiderResult[] | null;
  lastInsiderId: string | null;
  seq: number;
  lastPriceSent: number;
  pricesDirty: boolean;
  customPersona: CustomJudgeResult | null;
  customPending: boolean;
}

export type ConnKind = "seat" | "aud" | "board";
export interface ConnInfo {
  kind: ConnKind | null;
  id: string | null;
}

export interface EngineDeps {
  now(): number;
  send(connId: string, msg: ServerMessage): void;
  close(connId: string, reason: string): void;
  llm: Llm;
  persist(state: RoomStateData): void;
  setAlarm(at: number | null): void;
  log(entry: Record<string, unknown>): void;
  /** Called when the room expires; the adapter clears storage. */
  expire(): void;
  /** Called with the ConnInfo whenever a socket's identity changes, so adapters can persist it. */
  attach?(connId: string, info: ConnInfo): void;
  seed?(): string;
}

export const JUDGE_NAMES = [
  "Judge Marguerite Holm", "Judge Barnaby Quill", "Judge Delphine Okafor", "Judge Rufus Penhaligon",
  "Judge Wanda Fitzgibbon", "Judge Cornelius Bray", "Judge Ottoline Marsh", "Judge Desmond Achterberg",
  "Judge Priya Castellanos", "Judge Hubert Lark", "Judge Imelda Thistlewood", "Judge Thaddeus Moon",
  "Judge Gloria Vantablack", "Judge Percival Snood", "Judge Agnes Kettleworth", "Judge Lorenzo Fairweather",
];

export const BOT_NAMES = ["Pickles", "Noodle", "Gizmo", "Waffles", "Tofu", "Sprocket", "Mochi", "Pebble", "Turnip"];

const MOODS: Record<TraitKind, Mood> = { identity: "neutral", loves: "delighted", hates: "grumpy", quirk: "smug" };

export function newRoomState(code: string, now: number): RoomStateData {
  return {
    v: 1,
    code,
    created: now,
    closed: false,
    phase: "LOBBY",
    phaseEndsAt: null,
    hostId: null,
    seats: [],
    audience: [],
    config: { rounds: DEFAULT_ROUNDS, insider: false, tutorial: true },
    gamesPlayed: 0,
    roundNo: 0,
    round: null,
    usedPrompts: [],
    usedTraits: [],
    lastActivity: now,
    examples: [],
    insiderHistory: [],
    insiderVotes: {},
    insiderResults: null,
    lastInsiderId: null,
    seq: 0,
    lastPriceSent: 0,
    pricesDirty: false,
    customPersona: null,
    customPending: false,
  };
}

export function sanitizeText(raw: string, max: number): string {
  // Strip control chars and the verdict prompt's delimiter characters; collapse whitespace.
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

// ---------- engine ----------

export class RoomEngine {
  s: RoomStateData;
  private conns = new Map<string, ConnInfo>();
  private buckets = new Map<string, { tokens: number; last: number }>();
  private pending = new Set<Promise<unknown>>();
  private needState = false;
  private needPrivate = new Set<string>(); // seat/aud ids, or "*"

  constructor(private deps: EngineDeps, state: RoomStateData) {
    this.s = state;
  }

  // ----- lifecycle hooks from the adapter -----

  connect(connId: string, info?: ConnInfo) {
    this.conns.set(connId, info ?? { kind: null, id: null });
  }

  /** Rebuild a connection after hibernation without side effects. */
  restore(connId: string, info: ConnInfo) {
    this.conns.set(connId, info);
  }

  connCount() {
    return this.conns.size;
  }

  message(connId: string, raw: unknown) {
    if (!this.conns.has(connId)) this.conns.set(connId, { kind: null, id: null });
    const msg = parseClientMessage(raw);
    if (!msg) {
      this.err(connId, "bad_message", "That message didn't make sense to the server.");
      return;
    }
    try {
      this.handle(connId, msg);
    } catch (e) {
      this.deps.log({ ev: "error", code: this.s.code, err: String(e) });
      this.err(connId, "server", "Something went wrong; the room is fine.");
    }
    this.flush();
  }

  disconnect(connId: string) {
    const info = this.conns.get(connId);
    this.conns.delete(connId);
    this.buckets.delete(connId);
    if (!info?.id) return;
    const stillHere = [...this.conns.values()].some((c) => c.kind === info.kind && c.id === info.id);
    if (stillHere) return;
    if (info.kind === "seat") {
      const seat = this.seat(info.id);
      if (seat) {
        seat.connected = false;
        if (this.s.hostId === seat.id) this.migrateHost();
      }
    } else if (info.kind === "aud") {
      const a = this.s.audience.find((x) => x.id === info.id);
      if (a) a.connected = false;
    }
    this.needState = true;
    this.flush();
  }

  alarm() {
    const now = this.deps.now();
    if (!this.s.closed && now - this.s.lastActivity >= ROOM_IDLE_MS) {
      this.s.closed = true;
      this.deps.log({ ev: "expire", code: this.s.code });
      for (const id of this.conns.keys()) this.deps.close(id, "This room has closed");
      this.conns.clear();
      this.deps.expire();
      return;
    }
    let guard = 0;
    while (guard++ < 50) {
      const progressed = this.tick(this.deps.now());
      if (!progressed) break;
    }
    this.flush();
  }

  /** Resolves when every in-flight LLM call has settled (used by tests). */
  async settle() {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  nextAlarm(): number | null {
    const s = this.s;
    if (s.closed) return null;
    const c: number[] = [s.lastActivity + ROOM_IDLE_MS];
    if (s.phaseEndsAt != null) c.push(s.phaseEndsAt);
    const r = s.round;
    if (r && s.phase === "WRITE") {
      for (const [id, at] of Object.entries(r.botSubmitAt)) if (!r.answers[id]) c.push(at);
    }
    if (r && s.phase === "MARKET") {
      if (!r.tell) c.push(r.marketEnd - TELL_AT_REMAINING_MS);
      for (const at of Object.values(r.botNext)) if (at < r.marketEnd - BOT_QUIET_FINAL_MS) c.push(at);
      if (s.pricesDirty) c.push(s.lastPriceSent + PRICE_BROADCAST_MS);
    }
    return Math.min(...c);
  }

  // ----- outbound helpers -----

  private send(connId: string, msg: ServerMessage) {
    this.deps.send(connId, msg);
  }

  private err(connId: string, code: string, message: string) {
    this.send(connId, { type: "error", code, message });
  }

  private toastAll(message: string) {
    for (const id of this.conns.keys()) this.send(id, { type: "toast", message });
  }

  private toastSeat(seatId: string, message: string) {
    for (const [id, c] of this.conns) if (c.id === seatId) this.send(id, { type: "toast", message });
  }

  private flush() {
    if (this.needState) {
      const state = this.publicState();
      for (const id of this.conns.keys()) if (this.conns.get(id)!.kind) this.send(id, { type: "state", state });
    }
    if (this.needState || this.needPrivate.size) {
      const all = this.needState || this.needPrivate.has("*");
      for (const [id, c] of this.conns) {
        if (!c.kind || c.kind === "board") continue;
        if (all || (c.id && this.needPrivate.has(c.id))) this.send(id, { type: "private", private: this.privateState(c) });
      }
    }
    this.needState = false;
    this.needPrivate.clear();
    this.deps.persist(this.s);
    this.deps.setAlarm(this.nextAlarm());
  }

  private track<T>(p: Promise<T>, label: string, onDone: (v: T | null) => void) {
    const start = this.deps.now();
    const wrapped = p
      .catch(() => null)
      .then((v) => {
        this.deps.log({ ev: "llm", call: label, code: this.s.code, ms: this.deps.now() - start, fallback: v == null });
        try {
          onDone(v as T | null);
        } catch (e) {
          this.deps.log({ ev: "error", code: this.s.code, err: String(e) });
        }
        this.flush();
      })
      .finally(() => this.pending.delete(wrapped));
    this.pending.add(wrapped);
  }

  // ----- lookups -----

  private seat(id: string | null | undefined) {
    return id ? this.s.seats.find((x) => x.id === id) : undefined;
  }

  private activeSeats() {
    return this.s.seats.filter((x) => !x.kicked);
  }

  private humans() {
    return this.s.seats.filter((x) => !x.isBot && !x.kicked);
  }

  private nextId(prefix: string) {
    this.s.seq += 1;
    return prefix + this.s.seq;
  }

  private seedStr() {
    return this.deps.seed ? this.deps.seed() : randomHex(8);
  }

  private setPhase(phase: Phase, durationMs: number | null) {
    this.s.phase = phase;
    this.s.phaseEndsAt = durationMs == null ? null : this.deps.now() + durationMs;
    this.needState = true;
    this.needPrivate.add("*");
    this.deps.log({ ev: "phase", code: this.s.code, phase, round: this.s.roundNo });
  }

  private migrateHost() {
    const candidates = this.humans()
      .filter((x) => x.connected)
      .sort((a, b) => a.connectedSince - b.connectedSince);
    const next = candidates[0];
    const prev = this.s.hostId;
    this.s.hostId = next ? next.id : null;
    if (next && next.id !== prev) this.toastAll(`${next.nick} is now the host.`);
    this.needState = true;
  }

  private uniqueNick(raw: string) {
    const taken = new Set([...this.s.seats.map((x) => x.nick.toLowerCase()), ...this.s.audience.map((x) => x.nick.toLowerCase())]);
    if (!taken.has(raw.toLowerCase())) return raw;
    for (let i = 2; i < 100; i++) {
      const base = raw.slice(0, NICK_MAX - String(i).length);
      const cand = base + i;
      if (!taken.has(cand.toLowerCase())) return cand;
    }
    return raw.slice(0, NICK_MAX - 4) + randomHex(2);
  }

  // ----- message handling -----

  private handle(connId: string, msg: ClientMessage) {
    const info = this.conns.get(connId)!;
    if (msg.type === "ping") {
      this.send(connId, { type: "pong", t: msg.t, now: this.deps.now() });
      return;
    }
    if (msg.type === "join") return this.join(connId, msg);
    if (!info.kind) return this.err(connId, "not_joined", "Join the room first.");
    if (info.kind === "board") return this.err(connId, "read_only", "The board is read-only.");
    this.s.lastActivity = this.deps.now();

    if (info.kind === "aud") {
      if (msg.type === "market.trade") return this.audienceTrade(connId, info.id!, msg);
      if (msg.type === "audience.vote") return this.audienceVote(connId, info.id!, msg.ticker);
      return this.err(connId, "audience", "Audience members can trade the crowd market and vote.");
    }

    const seat = this.seat(info.id)!;
    const isHost = this.s.hostId === seat.id;
    if (msg.type.startsWith("host.") && !isHost) return this.err(connId, "not_host", "Only the host can do that.");

    switch (msg.type) {
      case "host.config":
        return this.configure(connId, msg);
      case "host.addBots":
        return this.addBots(connId);
      case "host.removeBots":
        return this.removeBots();
      case "host.kick":
        return this.kick(connId, seat, msg.seatId);
      case "host.start":
        return this.start(connId);
      case "host.skip":
        return this.skip(connId);
      case "host.extend":
        if (this.s.phase === "REVEAL" && this.s.phaseEndsAt) {
          this.s.phaseEndsAt += REVEAL_EXTEND_MS;
          this.needState = true;
        }
        return;
      case "clue.ack":
        return this.ackClue(seat);
      case "write.submit":
        return this.submit(connId, seat, msg.text);
      case "market.trade":
        return this.trade(connId, seat, msg);
      case "insider.vote":
        return this.insiderVote(connId, seat, msg.seatId);
      case "audience.vote":
        return this.err(connId, "audience_only", "Only the audience votes for the crowd pick.");
    }
  }

  private join(connId: string, msg: Extract<ClientMessage, { type: "join" }> & { board?: boolean }) {
    const now = this.deps.now();
    if (this.s.closed) {
      this.err(connId, "closed", "This room has closed.");
      this.deps.close(connId, "closed");
      return;
    }
    this.s.lastActivity = now;
    const info = this.conns.get(connId)!;

    if (msg.seatToken) {
      const seat = this.s.seats.find((x) => x.token === msg.seatToken);
      if (seat) {
        if (seat.kicked) {
          this.err(connId, "kicked", "The host removed you from this room.");
          return;
        }
        this.bind(connId, info, "seat", seat.id);
        if (!seat.connected) {
          seat.connected = true;
          seat.connectedSince = now;
        }
        const host = this.seat(this.s.hostId);
        if (!host || !host.connected) {
          this.s.hostId = seat.id;
        }
        this.welcome(connId, seat.id, seat.token, "player");
        return;
      }
      const aud = this.s.audience.find((x) => x.token === msg.seatToken);
      if (aud) {
        aud.connected = true;
        this.bind(connId, info, "aud", aud.id);
        this.welcome(connId, aud.id, aud.token, "audience");
        return;
      }
    }

    const rawNick = sanitizeText(msg.nickname, NICK_MAX);
    if (rawNick.length < NICK_MIN) return this.err(connId, "nick", `Nicknames are ${NICK_MIN} to ${NICK_MAX} characters.`);
    if (localFlag(rawNick)) return this.err(connId, "nick", "Pick a different nickname.");

    if (msg.asAudience && rawNick === "__board__") {
      this.bind(connId, info, "board", null);
      this.send(connId, { type: "welcome", seatId: null, seatToken: null, role: "audience" });
      this.needState = true;
      return;
    }

    const nick = this.uniqueNick(rawNick);
    const inGame = this.s.phase !== "LOBBY" && this.s.phase !== "GAME_OVER";
    if (!msg.asAudience && !inGame && this.activeSeats().length >= MAX_PLAYERS) {
      // make room by dropping a bot if we can
      const bot = [...this.s.seats].reverse().find((x) => x.isBot);
      if (bot) this.s.seats = this.s.seats.filter((x) => x !== bot);
    }
    if (msg.asAudience || inGame || this.activeSeats().length >= MAX_PLAYERS) {
      const aud: AudienceMember = {
        id: this.nextId("a"),
        token: randomHex(16),
        nick,
        connected: true,
        wantsSeat: !msg.asAudience,
        net: 0,
        cash: AUDIENCE_CREDITS,
        holdings: this.s.round ? new Array(this.s.round.tickers.length).fill(0) : [],
        vote: null,
      };
      this.s.audience.push(aud);
      this.bind(connId, info, "aud", aud.id);
      this.welcome(connId, aud.id, aud.token, "audience");
      if (!msg.asAudience) {
        this.send(connId, {
          type: "toast",
          message: inGame
            ? "A game is in progress. You're in the audience until the next game."
            : "The room is full. You're in the audience.",
        });
      }
      return;
    }

    const seat: Seat = {
      id: this.nextId("s"),
      token: randomHex(16),
      nick,
      isBot: false,
      connected: true,
      connectedSince: now,
      joinedAt: now,
      away: false,
      missedRounds: 0,
      kicked: false,
      score: 0,
      royalties: 0,
      roundScores: [],
    };
    this.s.seats.push(seat);
    const host = this.seat(this.s.hostId);
    if (!host || !host.connected) this.s.hostId = seat.id;
    this.bind(connId, info, "seat", seat.id);
    this.welcome(connId, seat.id, seat.token, "player");
  }

  private bind(connId: string, info: ConnInfo, kind: ConnKind, id: string | null) {
    info.kind = kind;
    info.id = id;
    this.deps.attach?.(connId, { kind, id });
  }

  private welcome(connId: string, id: string, token: string, role: "player" | "audience") {
    this.send(connId, { type: "welcome", seatId: id, seatToken: token, role });
    this.needState = true;
    this.needPrivate.add(id);
    const r = this.s.round;
    if (r && this.s.phase === "MARKET") {
      this.send(connId, { type: "prices", q: r.q, prices: lmsrPrices(r.q, r.b), t: this.deps.now() });
    }
  }

  private configure(connId: string, msg: Extract<ClientMessage, { type: "host.config" }>) {
    if (this.s.phase !== "LOBBY" && this.s.phase !== "GAME_OVER") return this.err(connId, "phase", "Change settings between games.");
    const custom = msg.customJudge ? sanitizeText(msg.customJudge, 200) : "";
    this.s.config = {
      rounds: msg.rounds,
      insider: msg.insider,
      tutorial: this.s.gamesPlayed === 0 ? true : msg.tutorial ?? true,
      customJudge: custom || undefined,
    };
    if (custom && custom !== this.s.customPersona?.name) this.requestCustomJudge(connId, custom);
    if (!custom) this.s.customPersona = null;
    this.needState = true;
  }

  private requestCustomJudge(connId: string, description: string) {
    this.s.customPending = true;
    this.s.customPersona = null;
    this.track(
      this.deps.llm.customJudge({
        description,
        identities: TRAITS.identities,
        loves: TRAITS.loves,
        hates: TRAITS.hates,
        quirks: TRAITS.quirks,
      }),
      "custom_judge",
      (res) => {
        this.s.customPending = false;
        if (this.s.config.customJudge !== description) return;
        if (!res) {
          this.s.config = { ...this.s.config, customJudge: undefined };
          this.toastSeat(this.s.hostId ?? "", "The judge-maker couldn't build that one. Try a different description, or play with a random judge.");
        } else {
          this.s.customPersona = res;
          this.toastSeat(this.s.hostId ?? "", `Custom judge ready: ${res.name}.`);
        }
        this.needState = true;
      },
    );
    void connId;
  }

  private addBots(connId: string) {
    if (this.s.phase !== "LOBBY" && this.s.phase !== "GAME_OVER") return this.err(connId, "phase", "Add bots in the lobby.");
    const n = this.activeSeats().length;
    const target = n < SOLO_PAD_TO ? SOLO_PAD_TO : Math.min(MAX_PLAYERS, n + 1);
    while (this.activeSeats().length < target) this.addBot();
    this.needState = true;
  }

  private addBot() {
    const used = new Set(this.s.seats.map((x) => x.nick));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot${this.s.seq + 1}`;
    const now = this.deps.now();
    this.s.seats.push({
      id: this.nextId("b"),
      token: randomHex(16),
      nick: name,
      isBot: true,
      connected: true,
      connectedSince: now,
      joinedAt: now,
      away: false,
      missedRounds: 0,
      kicked: false,
      score: 0,
      royalties: 0,
      roundScores: [],
    });
  }

  private removeBots() {
    if (this.s.phase !== "LOBBY" && this.s.phase !== "GAME_OVER") return;
    this.s.seats = this.s.seats.filter((x) => !x.isBot);
    this.needState = true;
  }

  private kick(connId: string, host: Seat, seatId: string) {
    const target = this.seat(seatId);
    if (!target || target.id === host.id) return this.err(connId, "kick", "Can't remove that player.");
    if (this.s.phase === "LOBBY" || this.s.phase === "GAME_OVER" || target.isBot) {
      if (target.isBot && this.s.phase !== "LOBBY" && this.s.phase !== "GAME_OVER") {
        target.kicked = true;
        target.away = true;
      } else this.s.seats = this.s.seats.filter((x) => x.id !== seatId);
    } else {
      target.kicked = true;
      target.away = true;
    }
    if (!target.isBot) {
      // keep kicked seats so their token is refused, but drop them from the lobby list
      if (!this.s.seats.includes(target)) this.s.seats.push({ ...target, kicked: true, away: true });
      for (const [id, c] of this.conns) {
        if (c.kind === "seat" && c.id === seatId) {
          this.err(id, "kicked", "The host removed you from this room.");
          this.deps.close(id, "kicked");
          this.conns.delete(id);
        }
      }
    }
    this.needState = true;
  }

  private start(connId: string) {
    if (this.s.phase !== "LOBBY" && this.s.phase !== "GAME_OVER") return this.err(connId, "phase", "A game is already running.");
    if (this.s.customPending) return this.err(connId, "custom", "Still building your custom judge, one moment.");
    // late joiners in the audience take seats for the new game
    for (const a of this.s.audience.filter((x) => x.wantsSeat && x.connected)) {
      if (this.activeSeats().length >= MAX_PLAYERS) break;
      const seat: Seat = {
        id: this.nextId("s"),
        token: a.token,
        nick: a.nick,
        isBot: false,
        connected: true,
        connectedSince: this.deps.now(),
        joinedAt: this.deps.now(),
        away: false,
        missedRounds: 0,
        kicked: false,
        score: 0,
        royalties: 0,
        roundScores: [],
      };
      this.s.seats.push(seat);
      this.s.audience = this.s.audience.filter((x) => x !== a);
      for (const [id, c] of this.conns) {
        if (c.kind === "aud" && c.id === a.id) {
          this.bind(id, c, "seat", seat.id);
          this.send(id, { type: "welcome", seatId: seat.id, seatToken: seat.token, role: "player" });
        }
      }
    }
    // remove kicked/away humans from the new game
    this.s.seats = this.s.seats.filter((x) => !x.away || x.kicked);
    if (this.humans().length < MIN_SEATS) {
      while (this.activeSeats().length < SOLO_PAD_TO) this.addBot();
    }
    if (this.activeSeats().length < MIN_SEATS) return this.err(connId, "seats", `Need at least ${MIN_SEATS} players.`);
    for (const x of this.s.seats) {
      x.score = 0;
      x.royalties = 0;
      x.roundScores = [];
      x.missedRounds = 0;
    }
    for (const a of this.s.audience) a.net = 0;
    this.s.roundNo = 0;
    this.s.insiderHistory = [];
    this.s.insiderVotes = {};
    this.s.insiderResults = null;
    this.s.lastInsiderId = null;
    this.s.usedTraits = [];
    this.startRound();
  }

  private skip(connId: string) {
    const p = this.s.phase;
    if (p === "MARKET") return this.err(connId, "phase", "The market always runs its full minute.");
    if (p === "GAME_OVER") {
      if (this.s.config.insider && !this.s.insiderResults) this.resolveInsider();
      return;
    }
    if (p === "LOBBY") return;
    if (p === "WRITE") {
      // skipping WRITE ends it now, ignoring pending moderation waits beyond their own deadline
      this.s.phaseEndsAt = this.deps.now();
    } else this.s.phaseEndsAt = this.deps.now();
    this.alarmNow();
  }

  private alarmNow() {
    let guard = 0;
    while (guard++ < 20 && this.tick(this.deps.now()));
  }

  // ----- round flow -----

  private startRound() {
    const s = this.s;
    s.roundNo += 1;
    const now = this.deps.now();
    const seed = this.seedStr();
    const rng = makeRng(seed + ":setup");
    const prompts = PROMPTS.filter((p) => !s.usedPrompts.includes(p.id));
    const prompt = rng.pick(prompts.length ? prompts : PROMPTS);
    s.usedPrompts.push(prompt.id);
    if (s.usedPrompts.length >= PROMPTS.length) s.usedPrompts = [prompt.id];

    let persona: Persona;
    const custom = s.customPersona;
    if (custom && s.config.customJudge) {
      persona = { ...custom, custom: true, description: s.config.customJudge };
    } else {
      const pickTrait = (deck: Trait[], cat: string) => {
        const fresh = deck.filter((t) => !s.usedTraits.includes(cat + ":" + t.id));
        const t = rng.pick(fresh.length ? fresh : deck);
        s.usedTraits.push(cat + ":" + t.id);
        return t;
      };
      persona = {
        name: "",
        voice: "",
        identity: pickTrait(TRAITS.identities, "i"),
        loves: pickTrait(TRAITS.loves, "l"),
        hates: pickTrait(TRAITS.hates, "h"),
        quirk: pickTrait(TRAITS.quirks, "q"),
      };
    }

    // deal clues round-robin over a shuffled kind order
    const kinds = rng.shuffle<TraitKind>(["identity", "loves", "hates", "quirk"]);
    const seats = rng.shuffle(this.activeSeats().filter((x) => !x.away));
    const clues: Record<string, TraitKind> = {};
    seats.forEach((x, i) => (clues[x.id] = kinds[i % kinds.length]));
    const counts: Record<TraitKind, number> = { identity: 0, loves: 0, hates: 0, quirk: 0 };
    for (const k of Object.values(clues)) counts[k]++;
    const judgeKinds: TraitKind[] = rng.shuffle(["loves", "hates", "quirk"] as TraitKind[]);
    const tellKind = judgeKinds.reduce((best, k) => (counts[k] < counts[best] ? k : best), judgeKinds[0]);

    let insiderId: string | null = null;
    if (s.config.insider) {
      const cands = seats.filter((x) => x.id !== s.lastInsiderId);
      if (cands.length) {
        insiderId = rng.pick(cands).id;
        s.lastInsiderId = insiderId;
        s.insiderHistory.push({ round: s.roundNo, insiderId });
      }
    }

    const tutorial = s.roundNo === 1 && s.config.tutorial;
    s.round = {
      no: s.roundNo,
      tutorial,
      prompt,
      persona,
      voiceReady: !!custom && !!s.config.customJudge,
      seed,
      commit: null,
      setupStart: now,
      clues,
      acks: [],
      tellKind,
      tellText: null,
      tell: null,
      answers: {},
      notes: {},
      botSubmitAt: {},
      botAnswers: null,
      decoysLlm: null,
      tickers: [],
      q: [],
      b: B_SMALL,
      cash: {},
      holdings: {},
      traded: [],
      priceHistory: [],
      marketStart: 0,
      marketEnd: 0,
      botNext: {},
      botTrades: 0,
      audQ: [],
      verdictStart: 0,
      verdict: null,
      reveal: null,
      insiderId,
    };
    for (const a of s.audience) {
      a.vote = null;
      a.holdings = [];
      a.cash = AUDIENCE_CREDITS;
    }

    const r = s.round;
    if (r.voiceReady) {
      this.setPhase("SETUP", SETUP_MS);
    } else {
      this.setPhase("SETUP", LLM_TIMEOUT_VOICE_MS);
      const { identity, loves, hates, quirk } = persona;
      this.track(this.deps.llm.personaVoice({ identity, loves, hates, quirk }), "persona_voice", (v) => {
        if (s.round !== r || r.voiceReady || s.phase !== "SETUP") return;
        if (v && v.name) {
          r.persona.name = sanitizeText(v.name, 40);
          r.persona.voice = sanitizeText(v.voice ?? "", 160);
        }
        r.voiceReady = true;
        s.phaseEndsAt = Math.max(this.deps.now(), r.setupStart + SETUP_MS);
      });
    }
  }

  /** Advance whatever is due at `now`. Returns true if something changed that might make more things due. */
  private tick(now: number): boolean {
    const s = this.s;
    const r = s.round;
    let changed = false;

    if (r && s.phase === "WRITE") {
      for (const [id, at] of Object.entries(r.botSubmitAt)) {
        if (!r.answers[id] && at <= now) {
          this.botSubmit(id);
          changed = true;
        }
      }
      if (changed) this.maybeEndWrite();
    }

    if (r && s.phase === "MARKET") {
      if (!r.tell && now >= r.marketEnd - TELL_AT_REMAINING_MS && now < r.marketEnd) {
        this.postTell();
        changed = true;
      }
      for (const [id, at] of Object.entries(r.botNext)) {
        if (at <= now) {
          if (now < r.marketEnd - BOT_QUIET_FINAL_MS) this.botTrade(id);
          const rng = makeRng(`${r.seed}:botnext:${id}:${r.botTrades}`);
          const next = now + rng.int(BOT_TRADE_MIN_MS, BOT_TRADE_MAX_MS);
          r.botNext[id] = next < r.marketEnd - BOT_QUIET_FINAL_MS ? next : Number.POSITIVE_INFINITY;
          changed = true;
        }
      }
      if (s.pricesDirty && now >= s.lastPriceSent + PRICE_BROADCAST_MS) this.sendPrices();
    }

    if (s.phaseEndsAt != null && now >= s.phaseEndsAt) {
      this.onPhaseEnd();
      return true;
    }
    return changed;
  }

  private onPhaseEnd() {
    const s = this.s;
    const r = s.round!;
    switch (s.phase) {
      case "SETUP":
        return this.enterClue();
      case "CLUE":
        return this.enterWrite();
      case "WRITE":
        return this.endWrite(true);
      case "MARKET":
        return this.enterVerdict();
      case "VERDICT":
        if (!r.verdict) {
          const kw = keywordJudge(r.persona, r.tickers, r.seed);
          r.verdict = {
            winner: kw.winner,
            runnerUp: kw.runnerUp,
            reason: makeRng(r.seed + ":reason").pick(FALLBACK_REASONS),
            fallback: true,
          };
        }
        return this.enterReveal();
      case "REVEAL":
        return this.setPhase("SCOREBOARD", SCOREBOARD_MS);
      case "SCOREBOARD":
        if (s.roundNo >= s.config.rounds) return this.enterGameOver();
        return this.startRound();
      default:
        s.phaseEndsAt = null;
    }
  }

  private enterClue() {
    const s = this.s;
    const r = s.round!;
    if (!r.persona.name) r.persona.name = makeRng(r.seed + ":name").pick(JUDGE_NAMES);
    r.voiceReady = true;
    r.commit = commitHash(r.persona, r.seed);
    this.setPhase("CLUE", CLUE_MS);
    for (const x of this.activeSeats()) if (x.isBot) r.acks.push(x.id);

    // Start every background LLM call now so their latency hides behind CLUE and WRITE.
    const examples = s.examples.slice(-2);
    const bots = this.activeSeats().filter((x) => x.isBot && !x.away);
    if (bots.length) {
      this.track(
        this.deps.llm.botAnswers({ prompt: r.prompt.text, count: bots.length, examples }),
        "bot_answers",
        (v) => {
          if (s.round !== r) return;
          r.botAnswers = (v ?? []).map((t) => sanitizeText(t, ANSWER_MAX)).filter((t) => t && !localFlag(t));
        },
      );
    }
    const count = this.decoyCount();
    const bait = Array.from({ length: Math.max(count, MIN_TICKERS) }, (_, i) =>
      makeRng(`${r.seed}:bait:${i}`).next() < DECOY_BAIT_RATE ? ("winner" as const) : ("loser" as const),
    );
    this.track(
      this.deps.llm.decoys({ persona: r.persona, prompt: r.prompt.text, count, bait: bait.slice(0, count), examples }),
      "decoys",
      (v) => {
        if (s.round !== r) return;
        r.decoysLlm = (v ?? []).map((t) => sanitizeText(t, ANSWER_MAX)).filter((t) => t && !localFlag(t));
      },
    );
    const trait = r.persona[r.tellKind];
    this.track(
      this.deps.llm.tell({ persona: r.persona, prompt: r.prompt.text, kind: r.tellKind, trait }),
      "tell",
      (v) => {
        if (s.round !== r || !v) return;
        const t = sanitizeText(v, 200);
        if (t) r.tellText = t;
      },
    );
  }

  private decoyCount() {
    return this.activeSeats().length <= DECOY_SMALL_ROOM_MAX ? DECOYS_SMALL_ROOM : DECOYS_LARGE_ROOM;
  }

  private ackClue(seat: Seat) {
    const r = this.s.round;
    if (!r || this.s.phase !== "CLUE") return;
    if (!r.acks.includes(seat.id)) r.acks.push(seat.id);
    this.needState = true;
    const waiting = this.activeSeats().filter((x) => !x.away && r.clues[x.id] && (x.isBot || x.connected) && !r.acks.includes(x.id));
    if (waiting.length === 0) {
      this.s.phaseEndsAt = this.deps.now();
      this.alarmNow();
    }
  }

  private enterWrite() {
    const r = this.s.round!;
    this.setPhase("WRITE", WRITE_MS);
    const now = this.deps.now();
    for (const x of this.activeSeats()) {
      if (!x.isBot || x.away) continue;
      const rng = makeRng(`${r.seed}:botwrite:${x.id}`);
      r.botSubmitAt[x.id] = now + rng.int(BOT_WRITE_MIN_MS, BOT_WRITE_MAX_MS);
    }
  }

  private botSubmit(id: string) {
    const r = this.s.round!;
    const taken = new Set(Object.values(r.answers).map((a) => a.text.toLowerCase()));
    let text = (r.botAnswers ?? []).find((t) => !taken.has(t.toLowerCase()));
    if (text) r.botAnswers = r.botAnswers!.filter((t) => t !== text);
    if (!text) {
      const bank = makeRng(`${r.seed}:botbank:${id}`).shuffle(decoysFor(r.prompt.category));
      text = bank.find((t) => !taken.has(t.toLowerCase())) ?? bank[0];
    }
    r.answers[id] = { text, flagged: false, pendingUntil: null };
    this.needState = true;
  }

  private submit(connId: string, seat: Seat, raw: string) {
    const s = this.s;
    const r = s.round;
    if (!r || s.phase !== "WRITE") return this.err(connId, "phase", "Writing time is over.");
    if (r.answers[seat.id]) return this.err(connId, "submitted", "You already submitted.");
    if (!r.clues[seat.id]) return this.err(connId, "not_in_round", "You're not in this round.");
    const text = sanitizeText(raw, ANSWER_MAX);
    if (text.length < 1) return this.err(connId, "empty", "Write something first.");
    const answer: Answer = { text, flagged: localFlag(text), pendingUntil: null };
    r.answers[seat.id] = answer;
    seat.missedRounds = 0;
    seat.away = false;
    if (!answer.flagged) {
      answer.pendingUntil = this.deps.now() + LLM_TIMEOUT_MODERATE_MS;
      this.track(this.deps.llm.moderate(text), "moderate", (flagged) => {
        answer.pendingUntil = null;
        if (flagged) answer.flagged = true;
        if (s.round === r && s.phase === "WRITE") this.maybeEndWrite();
      });
    }
    this.needState = true;
    this.needPrivate.add(seat.id);
    this.maybeEndWrite();
  }

  private maybeEndWrite() {
    const r = this.s.round!;
    const expected = this.activeSeats().filter((x) => r.clues[x.id] && !x.away && (x.isBot || x.connected));
    if (expected.every((x) => r.answers[x.id])) this.endWrite(false);
  }

  private endWrite(timerExpired: boolean) {
    const s = this.s;
    const r = s.round!;
    const now = this.deps.now();
    const waits = Object.values(r.answers)
      .map((a) => a.pendingUntil)
      .filter((t): t is number => t != null && t > now);
    if (waits.length) {
      // hold WRITE open until moderation answers or times out
      s.phaseEndsAt = Math.max(...waits);
      this.needState = true;
      return;
    }
    void timerExpired;
    this.buildTickers();
    this.enterMarket();
  }

  private buildTickers() {
    const s = this.s;
    const r = s.round!;
    const real: InternalTicker[] = [];
    for (const x of this.activeSeats()) {
      if (!r.clues[x.id]) continue;
      const a = r.answers[x.id];
      if (!a) {
        r.answers[x.id] = { text: NO_ANSWER, flagged: false, pendingUntil: null };
        continue;
      }
      if (a.flagged) {
        (r.notes[x.id] ??= []).push("Your answer was removed by the content filter. You can still trade.");
        continue;
      }
      real.push({ ticker: "", text: a.text, author: x.id, isDecoy: false });
      if (!x.isBot) s.examples = [...s.examples, a.text].slice(-6);
    }
    const need = Math.max(this.decoyCount(), MIN_TICKERS - real.length);
    const taken = new Set(real.map((t) => t.text.toLowerCase()));
    const decoys: string[] = [];
    for (const t of r.decoysLlm ?? []) {
      if (decoys.length >= need) break;
      if (!taken.has(t.toLowerCase())) {
        decoys.push(t);
        taken.add(t.toLowerCase());
      }
    }
    const bank = makeRng(r.seed + ":decoybank").shuffle(decoysFor(r.prompt.category));
    for (const t of bank) {
      if (decoys.length >= need) break;
      if (!taken.has(t.toLowerCase())) {
        decoys.push(t);
        taken.add(t.toLowerCase());
      }
    }
    const all = [...real, ...decoys.map((text) => ({ ticker: "", text, author: null, isDecoy: true }))];
    r.tickers = makeRng(r.seed + ":order")
      .shuffle(all)
      .map((t, i) => ({ ...t, ticker: TICKERS[i] }));
  }

  private enterMarket() {
    const s = this.s;
    const r = s.round!;
    const n = r.tickers.length;
    const now = this.deps.now();
    r.q = new Array(n).fill(0);
    r.audQ = new Array(n).fill(0);
    r.b = this.activeSeats().length <= B_SMALL_MAX_SEATS ? B_SMALL : B_LARGE;
    for (const x of this.activeSeats()) {
      if (!r.clues[x.id]) continue;
      r.cash[x.id] = CREDITS_PER_ROUND;
      r.holdings[x.id] = new Array(n).fill(0);
    }
    for (const a of s.audience) {
      a.cash = AUDIENCE_CREDITS;
      a.holdings = new Array(n).fill(0);
      a.vote = null;
    }
    r.marketStart = now;
    r.marketEnd = now + MARKET_MS;
    r.priceHistory = [{ t: 0, p: lmsrPrices(r.q, r.b).map((p) => Math.round(p * 1000) / 1000) }];
    for (const x of this.activeSeats()) {
      if (!x.isBot || x.away || !r.clues[x.id]) continue;
      r.botNext[x.id] = now + makeRng(`${r.seed}:botfirst:${x.id}`).int(BOT_TRADE_MIN_MS, BOT_TRADE_MAX_MS);
    }
    this.setPhase("MARKET", MARKET_MS);
    s.lastPriceSent = now;
    s.pricesDirty = false;
  }

  private postTell() {
    const r = this.s.round!;
    const trait = r.persona[r.tellKind];
    const text = r.tellText ?? `The judge mutters something about ${trait.text}.`;
    r.tell = { text, mood: MOODS[r.tellKind] };
    for (const [id, c] of this.conns) if (c.kind) this.send(id, { type: "tell", text, mood: r.tell.mood });
    this.needState = true;
  }

  private samplePrices() {
    const r = this.s.round!;
    const t = this.deps.now() - r.marketStart;
    const p = lmsrPrices(r.q, r.b).map((x) => Math.round(x * 1000) / 1000);
    const last = r.priceHistory[r.priceHistory.length - 1];
    if (last && t - last.t < 250) r.priceHistory[r.priceHistory.length - 1] = { t: last.t, p };
    else if (r.priceHistory.length < 400) r.priceHistory.push({ t, p });
  }

  private sendPrices() {
    const s = this.s;
    const r = s.round!;
    const now = this.deps.now();
    const msg: ServerMessage = { type: "prices", q: r.q, prices: lmsrPrices(r.q, r.b), t: now };
    for (const [id, c] of this.conns) if (c.kind) this.send(id, msg);
    s.lastPriceSent = now;
    s.pricesDirty = false;
  }

  private pricesChanged() {
    const s = this.s;
    this.samplePrices();
    if (this.deps.now() - s.lastPriceSent >= PRICE_BROADCAST_MS) this.sendPrices();
    else s.pricesDirty = true;
  }

  private rateOk(connId: string) {
    const now = this.deps.now();
    const b = this.buckets.get(connId) ?? { tokens: TRADE_RATE_PER_SEC, last: now };
    b.tokens = Math.min(TRADE_RATE_PER_SEC, b.tokens + ((now - b.last) / 1000) * TRADE_RATE_PER_SEC);
    b.last = now;
    if (b.tokens < 1) {
      this.buckets.set(connId, b);
      return false;
    }
    b.tokens -= 1;
    this.buckets.set(connId, b);
    return true;
  }

  /** Validate and apply a trade against a market. Returns an error string or null. */
  private applyTrade(
    q: number[],
    b: number,
    holdings: number[],
    cash: number,
    idx: number,
    side: "buy" | "sell",
    qty: number,
    expectedCost: number | null,
  ): { error: string; code: string } | { cost: number } {
    if (side === "buy") {
      if (holdings[idx] + qty > MAX_SHARES_PER_OUTCOME)
        return { code: "cap", error: `You can hold at most ${MAX_SHARES_PER_OUTCOME} shares of one answer.` };
      const cost = tradeCost(q, b, idx, qty);
      if (cost > cash + 1e-9) return { code: "cash", error: "Not enough credits for that." };
      if (expectedCost != null && Math.abs(cost - expectedCost) > COST_TOLERANCE)
        return { code: "stale", error: "Prices moved. Try again." };
      return { cost };
    }
    if (holdings[idx] < qty) return { code: "no_shares", error: "You don't own that many shares." };
    const cost = tradeCost(q, b, idx, -qty);
    if (expectedCost != null && Math.abs(cost - expectedCost) > COST_TOLERANCE)
      return { code: "stale", error: "Prices moved. Try again." };
    return { cost };
  }

  private trade(connId: string, seat: Seat, msg: Extract<ClientMessage, { type: "market.trade" }>) {
    const s = this.s;
    const r = s.round;
    const now = this.deps.now();
    if (!r || s.phase !== "MARKET" || now >= r.marketEnd) return this.err(connId, "frozen", "Trading is closed.");
    if (!this.rateOk(connId)) return this.err(connId, "rate", "Slow down a little.");
    const idx = r.tickers.findIndex((t) => t.ticker === msg.ticker);
    if (idx < 0 || !r.holdings[seat.id]) return this.err(connId, "ticker", "That answer isn't in this market.");
    const res = this.applyTrade(r.q, r.b, r.holdings[seat.id], r.cash[seat.id], idx, msg.side, msg.qty, msg.expectedCost);
    if ("error" in res) {
      this.err(connId, res.code, res.error);
      if (res.code === "stale") this.send(connId, { type: "prices", q: r.q, prices: lmsrPrices(r.q, r.b), t: now });
      return;
    }
    r.q[idx] += msg.side === "buy" ? msg.qty : -msg.qty;
    r.holdings[seat.id][idx] += msg.side === "buy" ? msg.qty : -msg.qty;
    r.cash[seat.id] -= res.cost;
    if (!r.traded.includes(seat.id)) r.traded.push(seat.id);
    seat.missedRounds = 0;
    seat.away = false;
    this.needPrivate.add(seat.id);
    this.pricesChanged();
  }

  private audienceTrade(connId: string, audId: string, msg: Extract<ClientMessage, { type: "market.trade" }>) {
    const s = this.s;
    const r = s.round;
    const a = s.audience.find((x) => x.id === audId);
    const now = this.deps.now();
    if (!r || !a || s.phase !== "MARKET" || now >= r.marketEnd) return this.err(connId, "frozen", "Trading is closed.");
    if (!this.rateOk(connId)) return this.err(connId, "rate", "Slow down a little.");
    const idx = r.tickers.findIndex((t) => t.ticker === msg.ticker);
    if (idx < 0) return this.err(connId, "ticker", "That answer isn't in this market.");
    if (a.holdings.length !== r.tickers.length) a.holdings = new Array(r.tickers.length).fill(0);
    const res = this.applyTrade(r.audQ, AUDIENCE_B, a.holdings, a.cash, idx, msg.side, msg.qty, msg.expectedCost);
    if ("error" in res) return this.err(connId, res.code, res.error);
    r.audQ[idx] += msg.side === "buy" ? msg.qty : -msg.qty;
    a.holdings[idx] += msg.side === "buy" ? msg.qty : -msg.qty;
    a.cash -= res.cost;
    this.needState = true; // audience market prices ride on the state snapshot
    this.needPrivate.add(a.id);
  }

  private audienceVote(connId: string, audId: string, ticker: string) {
    const s = this.s;
    const r = s.round;
    const a = s.audience.find((x) => x.id === audId);
    if (!r || !a || s.phase !== "MARKET") return this.err(connId, "phase", "Voting is open during the market.");
    if (!r.tickers.some((t) => t.ticker === ticker)) return this.err(connId, "ticker", "Pick an answer on the board.");
    a.vote = ticker;
    this.needPrivate.add(a.id);
    this.needState = true;
  }

  private botTrade(id: string) {
    const r = this.s.round!;
    const seat = this.seat(id);
    if (!seat || !r.holdings[id]) return;
    r.botTrades += 1;
    const rng = makeRng(`${r.seed}:bottrade:${id}:${r.botTrades}`);
    const known: { kind: TraitKind; trait: Trait }[] = [];
    if (r.insiderId === id) {
      for (const k of ["identity", "loves", "hates", "quirk"] as TraitKind[]) known.push({ kind: k, trait: r.persona[k] });
    } else {
      const k = r.clues[id];
      if (k) known.push({ kind: k, trait: r.persona[k] });
      if (r.tell && r.tellKind !== k) known.push({ kind: r.tellKind, trait: r.persona[r.tellKind] });
    }
    const scores = r.tickers.map((t) => partialScore(known, t.text) + rng.gauss(BOT_NOISE_SIGMA));
    const max = Math.max(...scores);
    const exps = scores.map((x) => Math.exp(x - max));
    const sum = exps.reduce((a, c) => a + c, 0);
    let top = 0;
    for (let i = 1; i < scores.length; i++) if (scores[i] > scores[top]) top = i;
    const belief = exps[top] / sum;
    const price = lmsrPrices(r.q, r.b)[top];
    if (price >= belief) return;
    let k = rng.int(BOT_BUY_MIN, BOT_BUY_MAX);
    k = Math.min(k, MAX_SHARES_PER_OUTCOME - r.holdings[id][top]);
    while (k > 0 && tradeCost(r.q, r.b, top, k) > r.cash[id]) k--;
    if (k <= 0) return;
    const cost = tradeCost(r.q, r.b, top, k);
    r.q[top] += k;
    r.holdings[id][top] += k;
    r.cash[id] -= cost;
    if (!r.traded.includes(id)) r.traded.push(id);
    this.pricesChanged();
  }

  private enterVerdict() {
    const s = this.s;
    const r = s.round!;
    if (s.pricesDirty) this.sendPrices();
    this.samplePrices();
    r.verdictStart = this.deps.now();
    r.botNext = {};
    this.setPhase("VERDICT", VERDICT_MAX_MS);
    const answers = r.tickers.map((t) => ({ ticker: t.ticker, text: t.text }));
    this.track(this.deps.llm.verdict({ persona: r.persona, prompt: r.prompt.text, answers }), "verdict", (v) => {
      if (s.round !== r || s.phase !== "VERDICT" || r.verdict) return;
      const valid = (t: string | null | undefined) => !!t && r.tickers.some((x) => x.ticker === t);
      if (!v || !valid(v.winner)) return; // alarm will apply the keyword judge
      const reason = sanitizeText(v.reason ?? "", 160) || "The judge has spoken.";
      r.verdict = { winner: v.winner, runnerUp: valid(v.runnerUp) && v.runnerUp !== v.winner ? v.runnerUp : null, reason, fallback: false };
      s.phaseEndsAt = Math.max(this.deps.now(), r.verdictStart + VERDICT_MIN_MS);
      this.needState = true;
    });
  }

  private enterReveal() {
    const s = this.s;
    const r = s.round!;
    const v = r.verdict!;
    const w = r.tickers.findIndex((t) => t.ticker === v.winner);
    const weight = r.tutorial ? TUTORIAL_WEIGHT : 1;

    // crowd pick: plurality of audience votes, ties to the earlier letter
    const tally: Record<string, number> = {};
    for (const a of s.audience) if (a.vote) tally[a.vote] = (tally[a.vote] ?? 0) + 1;
    const crowdPick =
      Object.entries(tally).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
    const crowdAuthor = crowdPick ? r.tickers.find((t) => t.ticker === crowdPick)?.author ?? null : null;

    const pnl: PnlRow[] = [];
    for (const x of this.activeSeats()) {
      if (r.cash[x.id] == null) continue;
      const holdings = r.holdings[x.id];
      const payout = holdings[w] + r.cash[x.id];
      const royalty = r.tickers[w].author === x.id ? ROYALTY : 0;
      const crowd = crowdAuthor === x.id ? CROWD_BONUS : 0;
      const roundScore = Math.round((payout + royalty + crowd - CREDITS_PER_ROUND) * weight) || 0;
      x.score += roundScore;
      x.royalties += royalty;
      x.roundScores.push(roundScore);
      const active = !!r.answers[x.id] && r.answers[x.id].text !== NO_ANSWER || r.traded.includes(x.id);
      if (!x.isBot) {
        if (active || x.connected) {
          if (active) x.missedRounds = 0;
        } else {
          x.missedRounds += 1;
          if (x.missedRounds >= AWAY_AFTER_MISSED_ROUNDS) x.away = true;
        }
      }
      pnl.push({
        seatId: x.id,
        nick: x.nick,
        isBot: x.isBot,
        holdings,
        spent: Math.round((CREDITS_PER_ROUND - r.cash[x.id]) * 100) / 100,
        payout: Math.round(payout * 100) / 100,
        royalty,
        crowd,
        roundScore,
        insider: r.insiderId === x.id,
      });
    }
    pnl.sort((a, b) => b.roundScore - a.roundScore);

    const audience: AudiencePnlRow[] = [];
    for (const a of s.audience) {
      if (a.holdings.length === r.tickers.length) {
        const net = Math.round(a.holdings[w] + a.cash - AUDIENCE_CREDITS);
        a.net += net;
      }
      audience.push({ id: a.id, nick: a.nick, net: a.net });
    }
    audience.sort((a, b) => b.net - a.net);

    const nick = (id: string) => this.seat(id)!;
    const noAnswer = this.activeSeats()
      .filter((x) => r.clues[x.id] && (!r.answers[x.id] || r.answers[x.id].text === NO_ANSWER || r.answers[x.id].flagged))
      .map((x) => ({ seatId: x.id, nick: x.nick, text: r.answers[x.id]?.flagged ? REMOVED_ANSWER : NO_ANSWER }));

    r.reveal = {
      round: r.no,
      persona: r.persona,
      seed: r.seed,
      commit: r.commit!,
      winner: v.winner,
      runnerUp: v.runnerUp,
      reason: v.reason,
      fallback: v.fallback,
      custom: !!r.persona.custom,
      prompt: r.prompt.text,
      tickers: r.tickers.map((t) => ({
        ticker: t.ticker,
        text: t.text,
        isDecoy: t.isDecoy,
        authors: t.author ? [{ seatId: t.author, nick: nick(t.author).nick, isBot: nick(t.author).isBot }] : [],
      })),
      noAnswer,
      pnl,
      priceHistory: r.priceHistory,
      crowdPick,
      audience,
      tutorial: r.tutorial,
    };
    this.setPhase("REVEAL", REVEAL_MS);
    for (const [id, c] of this.conns) if (c.kind) this.send(id, { type: "reveal", reveal: r.reveal });
  }

  private enterGameOver() {
    this.s.gamesPlayed += 1;
    this.s.config = { ...this.s.config, tutorial: this.s.config.tutorial };
    this.setPhase("GAME_OVER", null);
    if (this.s.config.insider) {
      // bots vote at random so humans don't wait on them
      for (const x of this.activeSeats().filter((y) => y.isBot)) {
        const others = this.activeSeats().filter((y) => y.id !== x.id);
        this.s.insiderVotes[x.id] = makeRng(`${this.s.round?.seed}:ivote:${x.id}`).pick(others).id;
      }
    }
  }

  private insiderVote(connId: string, seat: Seat, target: string) {
    const s = this.s;
    if (s.phase !== "GAME_OVER" || !s.config.insider || s.insiderResults) return this.err(connId, "phase", "No vote right now.");
    if (!this.seat(target) || target === seat.id) return this.err(connId, "vote", "Vote for someone else.");
    s.insiderVotes[seat.id] = target;
    this.needState = true;
    this.needPrivate.add(seat.id);
    const voters = this.activeSeats().filter((x) => !x.away && (x.isBot || x.connected));
    if (voters.every((x) => s.insiderVotes[x.id])) this.resolveInsider();
  }

  private resolveInsider() {
    const s = this.s;
    const tally: Record<string, number> = {};
    const votes = Object.values(s.insiderVotes);
    for (const v of votes) tally[v] = (tally[v] ?? 0) + 1;
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    const accused = top && top[1] > votes.length / 2 ? top[0] : null;
    s.insiderResults = s.insiderHistory.map(({ round, insiderId }) => {
      const seat = this.seat(insiderId);
      const caught = accused === insiderId;
      if (seat) {
        const idx = round - 1;
        if (caught) {
          const lost = Math.max(0, seat.roundScores[idx] ?? 0);
          seat.score -= lost;
        } else {
          seat.score += INSIDER_MISS_BONUS;
        }
      }
      return { round, insiderId, insiderNick: seat?.nick ?? "?", caught };
    });
    this.needState = true;
  }

  // ----- snapshots -----

  standings(): Standing[] {
    return this.s.seats
      .filter((x) => !x.kicked && !x.away && x.roundScores.length > 0)
      .map((x) => ({ seatId: x.id, nick: x.nick, isBot: x.isBot, score: x.score, royalties: x.royalties, rounds: x.roundScores, joinedAt: x.joinedAt }))
      .sort((a, b) => b.score - a.score || b.royalties - a.royalties || Number(a.isBot) - Number(b.isBot) || a.joinedAt - b.joinedAt)
      .map(({ joinedAt: _j, ...rest }) => rest);
  }

  publicState(): PublicState {
    const s = this.s;
    const r = s.round;
    const inRound = r && s.phase !== "LOBBY";
    const showTickers = r && ["MARKET", "VERDICT", "REVEAL", "SCOREBOARD"].includes(s.phase);
    return {
      code: s.code,
      phase: s.phase,
      phaseEndsAt: s.phaseEndsAt,
      now: this.deps.now(),
      round: s.roundNo,
      totalRounds: s.config.rounds,
      tutorialRound: !!(inRound && r!.tutorial && s.phase !== "GAME_OVER"),
      config: s.config,
      gamesPlayed: s.gamesPlayed,
      hostId: s.hostId,
      seats: s.seats
        .filter((x) => !x.kicked)
        .map((x) => ({
          id: x.id,
          nick: x.nick,
          isBot: x.isBot,
          connected: x.connected,
          away: x.away,
          submitted: !!(r && s.phase === "WRITE" && r.answers[x.id]),
          acked: !!(r && s.phase === "CLUE" && r.acks.includes(x.id)),
          score: x.score,
          royalties: x.royalties,
          joinedAt: x.joinedAt,
        })),
      audienceCount: s.audience.length,
      audience: s.audience
        .map((a) => ({ id: a.id, nick: a.nick, net: a.net }))
        .sort((a, b) => b.net - a.net),
      prompt: inRound && s.phase !== "SETUP" && s.phase !== "GAME_OVER" ? r!.prompt.text : null,
      judgeName: inRound && s.phase !== "SETUP" && s.phase !== "GAME_OVER" ? r!.persona.name : null,
      commit: inRound && s.phase !== "GAME_OVER" ? r!.commit : null,
      tickers: showTickers ? r!.tickers.map((t) => ({ ticker: t.ticker, text: t.text })) : [],
      q: showTickers ? r!.q : [],
      b: r ? r.b : B_SMALL,
      priceHistory: showTickers ? r!.priceHistory : [],
      tell: showTickers ? r!.tell : null,
      reveal: r && (s.phase === "REVEAL" || s.phase === "SCOREBOARD") ? r.reveal : null,
      standings: this.standings(),
      insiderResults: s.insiderResults,
      insiderVotes: Object.keys(s.insiderVotes).length,
      marketEndsAt: r && s.phase === "MARKET" ? r.marketEnd : null,
      audienceQ: showTickers ? r!.audQ : [],
      crowdVotes: showTickers ? this.crowdTally() : {},
      customPending: s.customPending,
      customReady: s.customPersona ? s.customPersona.name : null,
    } as PublicState;
  }

  private crowdTally() {
    const t: Record<string, number> = {};
    for (const a of this.s.audience) if (a.vote) t[a.vote] = (t[a.vote] ?? 0) + 1;
    return t;
  }

  privateState(c: ConnInfo): PrivateState {
    const s = this.s;
    const r = s.round;
    if (c.kind === "aud") {
      const a = s.audience.find((x) => x.id === c.id);
      return {
        seatId: a?.id ?? null,
        role: "audience",
        nick: a?.nick ?? "",
        clue: null,
        cash: a?.cash ?? 0,
        holdings: a?.holdings ?? [],
        submitted: null,
        fullPersona: null,
        isInsider: false,
        crowdVote: a?.vote ?? null,
        insiderVote: null,
        notes: [],
      };
    }
    const seat = this.seat(c.id);
    const id = seat?.id ?? "";
    const kind = r ? r.clues[id] : undefined;
    const showClue = r && kind && s.phase !== "LOBBY" && s.phase !== "SETUP" && s.phase !== "GAME_OVER";
    const clue: Clue | null = showClue ? { kind: kind!, text: "The judge " + r!.persona[kind!].clue_text } : null;
    const isInsider = !!(r && r.insiderId === id && showClue);
    return {
      seatId: id,
      role: "player",
      nick: seat?.nick ?? "",
      clue,
      cash: r?.cash[id] ?? 0,
      holdings: r?.holdings[id] ?? [],
      submitted: r?.answers[id]?.text ?? null,
      fullPersona: isInsider ? r!.persona : null,
      isInsider,
      crowdVote: null,
      insiderVote: s.insiderVotes[id] ?? null,
      notes: r?.notes[id] ?? [],
    };
  }
}
