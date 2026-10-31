import type { ClientMessage, Phase, PrivateState, PublicState, RevealData, ServerMessage } from "@mindshare/shared";
import { lmsrPrices, tradeCost } from "@mindshare/shared";
import { RoomEngine, newRoomState } from "../src/engine";
import type { RoomStateData } from "../src/engine";
import type { Llm } from "../src/llm";
import { NullLlm } from "../src/llm";

export class Client {
  inbox: ServerMessage[] = [];
  state: PublicState | null = null;
  priv: PrivateState | null = null;
  token: string | null = null;
  seatId: string | null = null;
  role: string | null = null;
  errors: { code: string; message: string }[] = [];
  toasts: string[] = [];
  reveal: RevealData | null = null;
  tell: string | null = null;
  q: number[] = [];
  open = true;
  constructor(public sim: Sim, public connId: string) {}

  receive(msg: ServerMessage) {
    this.inbox.push(msg);
    if (msg.type === "state") {
      this.state = msg.state;
      if (msg.state.q.length) this.q = msg.state.q;
    } else if (msg.type === "private") this.priv = msg.private;
    else if (msg.type === "welcome") {
      this.token = msg.seatToken;
      this.seatId = msg.seatId;
      this.role = msg.role;
    } else if (msg.type === "error") this.errors.push({ code: msg.code, message: msg.message });
    else if (msg.type === "toast") this.toasts.push(msg.message);
    else if (msg.type === "reveal") this.reveal = msg.reveal;
    else if (msg.type === "tell") this.tell = msg.text;
    else if (msg.type === "prices") this.q = msg.q;
  }

  send(msg: ClientMessage | Record<string, unknown>) {
    this.sim.engine.message(this.connId, JSON.stringify(msg));
  }

  join(nickname: string, extra: Record<string, unknown> = {}) {
    this.send({ type: "join", code: this.sim.engine.s.code, nickname, ...extra });
    return this;
  }

  lastError() {
    return this.errors[this.errors.length - 1];
  }

  /** Buy using the client's own view of q, like the real client does. */
  buy(ticker: string, qty = 1) {
    const st = this.state!;
    const i = st.tickers.findIndex((t) => t.ticker === ticker);
    const cost = tradeCost(this.q, st.b, i, qty);
    this.send({ type: "market.trade", ticker, side: "buy", qty, expectedCost: cost });
  }

  sell(ticker: string, qty = 1) {
    const st = this.state!;
    const i = st.tickers.findIndex((t) => t.ticker === ticker);
    const cost = tradeCost(this.q, st.b, i, -qty);
    this.send({ type: "market.trade", ticker, side: "sell", qty, expectedCost: cost });
  }

  prices() {
    return lmsrPrices(this.q, this.state!.b);
  }

  disconnect() {
    this.open = false;
    this.sim.engine.disconnect(this.connId);
  }
}

export class Sim {
  now = 1_700_000_000_000;
  alarmAt: number | null = null;
  engine: RoomEngine;
  clients = new Map<string, Client>();
  persisted: RoomStateData | null = null;
  expired = false;
  logs: Record<string, unknown>[] = [];
  private n = 0;
  private seedN = 0;

  constructor(public llm: Llm = new NullLlm(), code = "TEST", seedPrefix = "seed") {
    this.engine = new RoomEngine(
      {
        now: () => this.now,
        send: (connId, msg) => {
          const c = this.clients.get(connId);
          if (c?.open) c.receive(JSON.parse(JSON.stringify(msg)));
        },
        close: (connId) => {
          const c = this.clients.get(connId);
          if (c) c.open = false;
        },
        llm,
        persist: (s) => (this.persisted = s),
        setAlarm: (at) => (this.alarmAt = at),
        log: (e) => this.logs.push(e),
        expire: () => (this.expired = true),
        seed: () => `${seedPrefix}-${++this.seedN}`,
      },
      newRoomState(code, this.now),
    );
  }

  client(): Client {
    const id = "c" + ++this.n;
    const c = new Client(this, id);
    this.clients.set(id, c);
    this.engine.connect(id);
    return c;
  }

  async settle() {
    await this.engine.settle();
  }

  async advance(ms: number) {
    const target = this.now + ms;
    for (let guard = 0; guard < 10_000; guard++) {
      await this.settle();
      const a = this.alarmAt;
      if (a == null || a > target) break;
      this.now = Math.max(this.now, a);
      this.engine.alarm();
    }
    this.now = target;
    await this.settle();
  }

  phase(): Phase {
    return this.engine.s.phase;
  }

  async until(phase: Phase, maxMs = 300_000) {
    const end = this.now + maxMs;
    let spins = 0;
    while (this.phase() !== phase && this.now < end) {
      if (++spins > 20_000) throw new Error(`alarm loop in ${this.phase()} (alarmAt=${this.alarmAt}, now=${this.now})`);
      await this.settle();
      if (this.phase() === phase) break;
      const a = this.alarmAt;
      if (a == null || a > end) throw new Error(`stuck in ${this.phase()} waiting for ${phase}`);
      this.now = Math.max(this.now, a);
      this.engine.alarm();
    }
    await this.settle();
    if (this.phase() !== phase) throw new Error(`timed out in ${this.phase()} waiting for ${phase}`);
  }
}

/** Fake LLM that returns fixtures; any method can be overridden or made to fail. */
export class FakeLlm implements Llm {
  calls: string[] = [];
  fail = false;
  overrides: Partial<Llm> = {};
  async personaVoice(p: Parameters<Llm["personaVoice"]>[0]) {
    this.calls.push("voice");
    if (this.overrides.personaVoice) return this.overrides.personaVoice(p);
    return this.fail ? null : { name: "Judge Fixture", voice: "speaks in short gruff sentences" };
  }
  async decoys(i: Parameters<Llm["decoys"]>[0]) {
    this.calls.push("decoys");
    if (this.overrides.decoys) return this.overrides.decoys(i);
    return this.fail ? null : Array.from({ length: i.count }, (_, k) => `a decoy answer number ${k + 1}`);
  }
  async tell(i: Parameters<Llm["tell"]>[0]) {
    this.calls.push("tell");
    if (this.overrides.tell) return this.overrides.tell(i);
    return this.fail ? null : "I once had a dream about this. Make of that what you will.";
  }
  async verdict(i: Parameters<Llm["verdict"]>[0]) {
    this.calls.push("verdict");
    if (this.overrides.verdict) return this.overrides.verdict(i);
    return this.fail ? null : { winner: i.answers[0].ticker, reason: "It spoke to me.", runnerUp: i.answers[1]?.ticker ?? null };
  }
  async botAnswers(i: Parameters<Llm["botAnswers"]>[0]) {
    this.calls.push("bots");
    if (this.overrides.botAnswers) return this.overrides.botAnswers(i);
    return this.fail ? null : Array.from({ length: i.count }, (_, k) => `bot fixture answer ${k + 1}`);
  }
  async moderate(t: string) {
    this.calls.push("moderate");
    if (this.overrides.moderate) return this.overrides.moderate(t);
    return this.fail ? null : /forbidden/i.test(t);
  }
  async customJudge(i: Parameters<Llm["customJudge"]>[0]) {
    this.calls.push("custom");
    if (this.overrides.customJudge) return this.overrides.customJudge(i);
    return this.fail ? null : { name: "Judge Custom", voice: "lectures", identity: i.identities[0], loves: i.loves[0], hates: i.hates[0], quirk: i.quirks[0] };
  }
}

/** Join n humans, host starts. Returns clients (first is host). */
export function room(sim: Sim, n: number): Client[] {
  const cs: Client[] = [];
  for (let i = 0; i < n; i++) cs.push(sim.client().join(`Player${i + 1}`));
  return cs;
}

export const ANSWERS = [
  "a puppy wearing a tiny raincoat",
  "my landlord's unopened voicemail",
  "a cheese wheel with a grudge",
  "the moon, but smaller",
  "an apology written in crayon",
  "three geese in a trench coat",
  "a haunted spreadsheet",
  "soup, but colder",
  "a fax from 1994",
  "the alarm clock that won",
];
