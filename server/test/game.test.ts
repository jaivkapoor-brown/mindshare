import { describe, expect, it } from "vitest";
import {
  CREDITS_PER_ROUND,
  MARKET_MS,
  NO_ANSWER,
  REMOVED_ANSWER,
  ROOM_IDLE_MS,
  ROYALTY,
  TUTORIAL_WEIGHT,
  WRITE_MS,
  isBlockedCode,
  isValidCode,
  randomCode,
} from "@mindshare/shared";
import { ANSWERS, Client, FakeLlm, Sim, room } from "./sim";

async function playRound(sim: Sim, cs: Client[], opts: { trade?: boolean; submit?: boolean } = {}) {
  const { trade = true, submit = true } = opts;
  await sim.until("CLUE");
  for (const c of cs) if (c.open) c.send({ type: "clue.ack" });
  await sim.until("WRITE");
  if (submit) cs.forEach((c, i) => c.open && c.send({ type: "write.submit", text: ANSWERS[(i + sim.engine.s.roundNo) % ANSWERS.length] }));
  await sim.until("MARKET");
  if (trade) {
    for (let step = 0; step < 6; step++) {
      cs.forEach((c, i) => {
        if (!c.open || c.role !== "player") return;
        const t = c.state!.tickers[(i + step) % c.state!.tickers.length].ticker;
        c.buy(t, 1 + ((i + step) % 3));
      });
      await sim.advance(7_000);
    }
  }
  await sim.until("VERDICT");
  await sim.until("REVEAL");
}

function expectConsistent(cs: Client[]) {
  const open = cs.filter((c) => c.open);
  const ref = JSON.stringify(open[0].state!.standings);
  for (const c of open) {
    expect(c.state!.phase).toBe(open[0].state!.phase);
    expect(JSON.stringify(c.state!.standings)).toBe(ref);
  }
}

describe("full games", () => {
  for (const n of [3, 6, 10]) {
    it(`${n} simulated players complete a 5-round game with consistent scores`, async () => {
      const sim = new Sim(new FakeLlm());
      const cs = room(sim, n);
      cs[0].send({ type: "host.start" });
      for (let r = 1; r <= 5; r++) {
        await playRound(sim, cs);
        const reveal = cs[0].reveal!;
        expect(reveal.round).toBe(r);
        // every seat's score is consistent with its holdings and the winner
        const w = reveal.tickers.findIndex((t) => t.ticker === reveal.winner);
        for (const row of reveal.pnl) {
          const raw = row.payout + row.royalty + row.crowd - CREDITS_PER_ROUND;
          expect(row.roundScore).toBe(Math.round(raw * (reveal.tutorial ? TUTORIAL_WEIGHT : 1)) || 0);
          expect(row.payout).toBeGreaterThanOrEqual(row.holdings[w] - 1e-6);
        }
        expectConsistent(cs);
        if (r < 5) await sim.until("SCOREBOARD");
      }
      await sim.until("GAME_OVER");
      expectConsistent(cs);
      const st = cs[0].state!.standings;
      expect(st.length).toBe(n);
      for (const s of st) expect(s.rounds.length).toBe(5);
      expect(cs.flatMap((c) => c.errors).filter((e) => e.code === "server")).toEqual([]);
      // replay: play again reuses the room with a fresh judge
      const firstPrompts = sim.engine.s.usedPrompts.slice();
      cs[0].send({ type: "host.start" });
      await sim.until("CLUE");
      expect(firstPrompts).not.toContain(sim.engine.s.round!.prompt.id);
    });
  }

  it("round 1 is the tutorial at half weight, and the host can skip it after the first game", async () => {
    const sim = new Sim();
    const cs = room(sim, 3);
    cs[0].send({ type: "host.config", rounds: 3, insider: false });
    cs[0].send({ type: "host.start" });
    await sim.until("CLUE");
    expect(cs[0].state!.tutorialRound).toBe(true);
    await sim.until("GAME_OVER", 600_000);
    cs[0].send({ type: "host.config", rounds: 3, insider: false, tutorial: false });
    cs[0].send({ type: "host.start" });
    await sim.until("CLUE");
    expect(cs[0].state!.tutorialRound).toBe(false);
  });
});

describe("rooms and sync", () => {
  it("all clients see the same lobby; start is refused under 3 seats", () => {
    const sim = new Sim();
    const [a, b] = room(sim, 2);
    expect(a.state!.seats.map((s) => s.nick)).toEqual(["Player1", "Player2"]);
    expect(b.state!.seats.length).toBe(2);
    expect(a.state!.hostId).toBe(a.seatId);
    b.send({ type: "host.start" });
    expect(b.lastError().code).toBe("not_host");
  });

  it("two players with the same nickname get a numeric suffix", () => {
    const sim = new Sim();
    sim.client().join("Sam");
    const b = sim.client().join("sam");
    expect(b.priv!.nick).toBe("sam2");
  });

  it("state carries server time so clients can correct clock skew", async () => {
    const sim = new Sim();
    const [a] = room(sim, 3);
    a.send({ type: "host.start" });
    await sim.until("CLUE");
    expect(a.state!.now).toBe(sim.now);
    expect(a.state!.phaseEndsAt! - a.state!.now).toBe(8_000);
  });

  it("host migrates to the longest-connected player; the old host returns as a normal player", async () => {
    const sim = new Sim();
    const [a, b, c] = room(sim, 3);
    sim.now += 10;
    a.disconnect();
    expect(b.state!.hostId).toBe(b.seatId);
    expect(b.toasts.some((t) => t.includes("Player2 is now the host"))).toBe(true);
    const a2 = sim.client().join("Player1", { seatToken: a.token });
    expect(a2.seatId).toBe(a.seatId);
    expect(a2.state!.hostId).toBe(b.seatId);
    b.send({ type: "host.start" });
    await sim.until("CLUE");
    expect(c.state!.phase).toBe("CLUE");
  });

  it("host migration mid-game keeps the game running", async () => {
    const sim = new Sim();
    const cs = room(sim, 3);
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    cs[0].disconnect();
    expect(cs[1].state!.hostId).toBe(cs[1].seatId);
    await playRound(sim, cs.slice(1));
    expect(cs[1].reveal).not.toBeNull();
  });

  it("room idle for 2 hours closes and refuses joins", async () => {
    const sim = new Sim();
    room(sim, 1);
    await sim.advance(ROOM_IDLE_MS + 1000);
    expect(sim.expired).toBe(true);
    const late = sim.client().join("Late");
    expect(late.lastError().code).toBe("closed");
  });

  it("room codes are 4 letters with no I/O and no blocked words", () => {
    for (let i = 0; i < 2000; i++) {
      const c = randomCode();
      expect(isValidCode(c)).toBe(true);
      expect(c).not.toMatch(/[IO]/);
      expect(isBlockedCode(c)).toBe(false);
    }
    expect(isBlockedCode("DAMN")).toBe(true);
    // collision retry: the generator is re-run until the code is free
    const vals = [0.1, 0.2, 0.3, 0.4, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
    let i = 0;
    const rand = () => vals[i++ % vals.length];
    const taken = new Set([randomCode(rand)]);
    let code = randomCode(rand);
    while (taken.has(code)) code = randomCode(rand);
    expect(taken.has(code)).toBe(false);
  });

  it("malformed messages get an error and never crash the room", () => {
    const sim = new Sim();
    const a = sim.client().join("Ann");
    a.send({ type: "market.trade", ticker: "ZZ" });
    sim.engine.message(a.connId, "{not json");
    expect(a.errors.filter((e) => e.code === "bad_message").length).toBe(2);
    expect(sim.phase()).toBe("LOBBY");
  });
});

describe("market rules", () => {
  async function toMarket(n = 3) {
    const sim = new Sim();
    const cs = room(sim, n);
    cs[0].send({ type: "host.start" });
    await sim.until("CLUE");
    cs.forEach((c) => c.send({ type: "clue.ack" }));
    await sim.until("WRITE");
    cs.forEach((c, i) => c.send({ type: "write.submit", text: ANSWERS[i] }));
    await sim.until("MARKET");
    return { sim, cs };
  }

  it("everyone submitting early advances WRITE immediately", async () => {
    const sim = new Sim();
    const cs = room(sim, 3);
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    const start = sim.now;
    cs.forEach((c, i) => c.send({ type: "write.submit", text: ANSWERS[i] }));
    await sim.settle();
    expect(sim.phase()).toBe("MARKET");
    expect(sim.now - start).toBeLessThan(WRITE_MS);
  });

  it("MARKET always runs its full timer and cannot be skipped", async () => {
    const { sim, cs } = await toMarket();
    const start = sim.now;
    cs[0].send({ type: "host.skip" });
    expect(sim.phase()).toBe("MARKET");
    await sim.until("VERDICT");
    expect(sim.now - start).toBe(MARKET_MS);
  });

  it("buying debits cash and moves the price", async () => {
    const { sim, cs } = await toMarket();
    const before = cs[0].prices()[0];
    cs[0].buy("A", 5);
    await sim.advance(200); // price broadcasts are capped at 10 Hz
    expect(cs[0].priv!.holdings[0]).toBe(5);
    expect(cs[0].priv!.cash).toBeLessThan(100);
    expect(cs[1].prices()[0]).toBeGreaterThan(before);
  });

  it("trades exceeding cash are rejected", async () => {
    const { cs } = await toMarket();
    for (let i = 0; i < 60; i++) cs[0].buy("A", 10);
    await Promise.resolve();
    expect(cs[0].errors.some((e) => e.code === "cash" || e.code === "cap" || e.code === "rate")).toBe(true);
    expect(cs[0].priv!.cash).toBeGreaterThanOrEqual(-1e-9);
  });

  it("selling shares you don't own is rejected (no shorting)", async () => {
    const { cs } = await toMarket();
    cs[0].sell("A", 1);
    expect(cs[0].lastError().code).toBe("no_shares");
  });

  it("buy then sell returns the cash", async () => {
    const { cs } = await toMarket();
    cs[0].buy("B", 4);
    cs[0].sell("B", 4);
    expect(cs[0].priv!.cash).toBeCloseTo(100, 6);
  });

  it("cost estimate mismatch is rejected and prices are resent", async () => {
    const { cs } = await toMarket();
    const n = cs[0].inbox.length;
    cs[0].send({ type: "market.trade", ticker: "A", side: "buy", qty: 1, expectedCost: 50 });
    expect(cs[0].lastError().code).toBe("stale");
    expect(cs[0].inbox.slice(n).some((m) => m.type === "prices")).toBe(true);
    expect(cs[0].priv!.cash).toBe(100);
  });

  it("trades after the freeze are rejected with no state change", async () => {
    const { sim, cs } = await toMarket();
    await sim.until("VERDICT");
    const q = sim.engine.s.round!.q.slice();
    cs[0].buy("A", 1);
    expect(cs[0].lastError().code).toBe("frozen");
    expect(sim.engine.s.round!.q).toEqual(q);
  });

  it("trades are rate-limited to 10 per second per socket", async () => {
    const { cs } = await toMarket();
    for (let i = 0; i < 15; i++) cs[0].buy("A", 1);
    expect(cs[0].errors.filter((e) => e.code === "rate").length).toBeGreaterThan(0);
  });

  it("players may trade their own answer", async () => {
    const { sim, cs } = await toMarket();
    const mine = sim.engine.s.round!.tickers.find((t) => t.author === cs[0].seatId)!;
    cs[0].buy(mine.ticker, 3);
    expect(cs[0].errors.length).toBe(0);
  });

  it("settlement pays shares of the winner, royalty to its author", async () => {
    const llm = new FakeLlm();
    const sim = new Sim(llm);
    const cs = room(sim, 3);
    cs[0].send({ type: "host.config", rounds: 3, insider: false });
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    cs.forEach((c, i) => c.send({ type: "write.submit", text: ANSWERS[i] }));
    await sim.until("MARKET");
    const authored = sim.engine.s.round!.tickers.find((t) => t.author === cs[1].seatId)!;
    llm.overrides.verdict = async () => ({ winner: authored.ticker, reason: "yes", runnerUp: null });
    cs[0].buy(authored.ticker, 10);
    await sim.until("REVEAL");
    const r = cs[0].reveal!;
    const row0 = r.pnl.find((p) => p.seatId === cs[0].seatId)!;
    const row1 = r.pnl.find((p) => p.seatId === cs[1].seatId)!;
    expect(row0.payout).toBeGreaterThan(100);
    expect(row1.royalty).toBe(ROYALTY);
    expect(row1.roundScore).toBe(Math.round(ROYALTY * TUTORIAL_WEIGHT));
  });
});

describe("answers", () => {
  it("disconnected player during WRITE gets (no answer) and can trade on return", async () => {
    const sim = new Sim();
    const cs = room(sim, 4);
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    cs[3].disconnect();
    cs.slice(0, 3).forEach((c, i) => c.send({ type: "write.submit", text: ANSWERS[i] }));
    await sim.until("MARKET");
    expect(sim.engine.s.round!.answers[cs[3].seatId!].text).toBe(NO_ANSWER);
    const back = sim.client().join("Player4", { seatToken: cs[3].token });
    expect(back.priv!.clue).not.toBeNull();
    back.buy("A", 1);
    expect(back.priv!.holdings[0]).toBe(1);
  });

  it("empty submissions become (no answer) at timeout", async () => {
    const sim = new Sim();
    const cs = room(sim, 3);
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    await sim.until("MARKET");
    for (const c of cs) expect(sim.engine.s.round!.answers[c.seatId!].text).toBe(NO_ANSWER);
    // fewer than 2 distinct answers: decoys fill to at least 3 tickers
    expect(sim.engine.s.round!.tickers.length).toBeGreaterThanOrEqual(3);
  });

  it("fewer than 2 distinct answers still yields at least 3 tickers", async () => {
    const sim = new Sim();
    const cs = room(sim, 3);
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    cs[0].send({ type: "write.submit", text: "same" });
    await sim.until("MARKET");
    expect(sim.engine.s.round!.tickers.length).toBeGreaterThanOrEqual(3);
  });

  it("duplicate answers stay separate tickers and the reveal shows both authors", async () => {
    const sim = new Sim();
    const cs = room(sim, 3);
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    cs.forEach((c) => c.send({ type: "write.submit", text: "a goose" }));
    await sim.until("REVEAL");
    const geese = cs[0].reveal!.tickers.filter((t) => t.text === "a goose");
    expect(geese.length).toBe(3);
    expect(new Set(geese.map((g) => g.authors[0].seatId)).size).toBe(3);
  });

  it("moderation flags an answer: replaced, author notified, round continues", async () => {
    const sim = new Sim(new FakeLlm());
    const cs = room(sim, 3);
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    cs[0].send({ type: "write.submit", text: "this is forbidden text" });
    cs[1].send({ type: "write.submit", text: "what the fuck" });
    cs[2].send({ type: "write.submit", text: "a nice cup of tea" });
    await sim.until("MARKET");
    const texts = cs[2].state!.tickers.map((t) => t.text);
    expect(texts.some((t) => /forbidden|fuck/.test(t))).toBe(false);
    expect(cs[0].priv!.notes.length).toBe(1);
    expect(cs[1].priv!.notes.length).toBe(1);
    await sim.until("REVEAL");
    expect(cs[0].reveal!.noAnswer.filter((x) => x.text === REMOVED_ANSWER).length).toBe(2);
  });

  it("answers are trimmed to 80 characters and stripped of delimiters", async () => {
    const sim = new Sim();
    const cs = room(sim, 3);
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    cs[0].send({ type: "write.submit", text: "<answer>" + "x".repeat(120) });
    expect(sim.engine.s.round!.answers[cs[0].seatId!].text.length).toBeLessThanOrEqual(80);
    expect(sim.engine.s.round!.answers[cs[0].seatId!].text).not.toContain("<");
  });
});

describe("reconnect and away", () => {
  it("reconnect mid-MARKET restores holdings, cash, clue and prices", async () => {
    const sim = new Sim();
    const cs = room(sim, 3);
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    cs.forEach((c, i) => c.send({ type: "write.submit", text: ANSWERS[i] }));
    await sim.until("MARKET");
    cs[1].buy("B", 3);
    const cash = cs[1].priv!.cash;
    const clue = cs[1].priv!.clue;
    cs[1].disconnect();
    const back = sim.client().join("whatever", { seatToken: cs[1].token });
    expect(back.priv!.holdings[1]).toBe(3);
    expect(back.priv!.cash).toBeCloseTo(cash, 9);
    expect(back.priv!.clue).toEqual(clue);
    expect(back.inbox.some((m) => m.type === "prices")).toBe(true);
    expect(back.state!.phase).toBe("MARKET");
  });

  it("a seat that misses 2 rounds is marked away and leaves the standings", async () => {
    const sim = new Sim();
    const cs = room(sim, 4);
    cs[0].send({ type: "host.config", rounds: 3, insider: false });
    cs[0].send({ type: "host.start" });
    cs[3].disconnect();
    const live = cs.slice(0, 3);
    await playRound(sim, live);
    await sim.until("SCOREBOARD");
    await playRound(sim, live);
    expect(sim.engine.s.seats.find((s) => s.id === cs[3].seatId)!.away).toBe(true);
    await sim.until("GAME_OVER", 600_000);
    expect(cs[0].state!.standings.some((s) => s.seatId === cs[3].seatId)).toBe(false);
  });
});

describe("audience", () => {
  it("late joiner becomes audience; votes count toward crowd bonus only", async () => {
    const sim = new Sim();
    const cs = room(sim, 3);
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    const late = sim.client().join("Latecomer");
    expect(late.role).toBe("audience");
    expect(late.toasts[0]).toMatch(/audience until the next game/);
    cs.forEach((c, i) => c.send({ type: "write.submit", text: ANSWERS[i] }));
    await sim.until("MARKET");
    const target = sim.engine.s.round!.tickers.find((t) => t.author === cs[2].seatId)!;
    late.send({ type: "audience.vote", ticker: target.ticker });
    late.buy(target.ticker, 2);
    expect(late.priv!.holdings.reduce((a, b) => a + b, 0)).toBe(2);
    expect(sim.engine.s.round!.q.every((x) => x === 0)).toBe(true); // player market untouched
    await sim.until("REVEAL");
    const row = cs[0].reveal!.pnl.find((p) => p.seatId === cs[2].seatId)!;
    expect(row.crowd).toBe(10);
    expect(cs[0].reveal!.crowdPick).toBe(target.ticker);
    expect(cs[0].reveal!.audience[0].nick).toBe("Latecomer");
  });

  it("late joiner takes a seat at the next game", async () => {
    const sim = new Sim();
    const cs = room(sim, 3);
    cs[0].send({ type: "host.config", rounds: 3, insider: false });
    cs[0].send({ type: "host.start" });
    await sim.until("WRITE");
    const late = sim.client().join("Latecomer");
    await sim.until("GAME_OVER", 600_000);
    cs[0].send({ type: "host.start" });
    expect(late.role).toBe("player");
    expect(sim.engine.s.seats.some((s) => s.nick === "Latecomer")).toBe(true);
  });

  it("board connection is read-only", () => {
    const sim = new Sim();
    room(sim, 3);
    const board = sim.client().join("__board__", { asAudience: true });
    expect(board.state).not.toBeNull();
    board.send({ type: "host.start" });
    expect(board.lastError().code).toBe("read_only");
  });
});

describe("room code claiming", () => {
  it("retries on collision until a free code is claimed", async () => {
    const { claimCode } = await import("../src/codes");
    const taken = new Set(["ABCD", "EFGH"]);
    const seq = ["ABCD", "EFGH", "JKLM"];
    let i = 0;
    const code = await claimCode(async (c) => !taken.has(c), () => seq[i++]);
    expect(code).toBe("JKLM");
    expect(i).toBe(3);
    expect(await claimCode(async () => false, () => "ZZZZ")).toBeNull();
  });
});
