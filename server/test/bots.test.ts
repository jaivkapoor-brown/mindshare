import { describe, expect, it } from "vitest";
import { BOT_QUIET_FINAL_MS } from "@mindshare/shared";
import { FakeLlm, Sim, room } from "./sim";

async function soloToMarket(llm = new FakeLlm()) {
  const sim = new Sim(llm);
  const [me] = room(sim, 1);
  me.send({ type: "host.addBots" });
  expect(me.state!.seats.length).toBe(4);
  me.send({ type: "host.start" });
  await sim.until("WRITE");
  me.send({ type: "write.submit", text: "a dog eating cheese" });
  await sim.until("MARKET");
  return { sim, me };
}

describe("solo mode and bots", () => {
  it("a room with fewer than 3 humans is padded to 4 seats at start", async () => {
    const sim = new Sim();
    const [a, b] = room(sim, 2);
    a.send({ type: "host.start" });
    expect(b.state!.seats.length).toBe(4);
    expect(b.state!.seats.filter((s) => s.isBot).length).toBe(2);
  });

  it("bots write answers (LLM batch, or canned bank on failure) and every seat gets a clue", async () => {
    for (const fail of [false, true]) {
      const llm = new FakeLlm();
      llm.fail = fail;
      const { sim } = await soloToMarket(llm);
      const r = sim.engine.s.round!;
      expect(Object.keys(r.clues).length).toBe(4);
      const botAnswers = r.tickers.filter((t) => t.author?.startsWith("b"));
      expect(botAnswers.length).toBe(3);
      if (!fail) expect(botAnswers.every((t) => t.text.startsWith("bot fixture"))).toBe(true);
    }
  });

  it("bots trade during the market and never in the final 3 seconds", async () => {
    const { sim } = await soloToMarket();
    const r = sim.engine.s.round!;
    const tradesAt: number[] = [];
    let lastQ = r.q.join();
    while (sim.phase() === "MARKET") {
      sim.now = sim.alarmAt!;
      sim.engine.alarm();
      await sim.settle();
      const q = sim.engine.s.round!.q.join();
      if (q !== lastQ && sim.phase() === "MARKET") tradesAt.push(sim.now);
      lastQ = q;
    }
    expect(tradesAt.length).toBeGreaterThan(0);
    for (const t of tradesAt) expect(t).toBeLessThan(r.marketEnd - BOT_QUIET_FINAL_MS);
  });

  it("bot trading is deterministic given the seed", async () => {
    const run = async () => {
      const { sim } = await soloToMarket();
      await sim.until("VERDICT");
      return sim.engine.s.round!.q.join();
    };
    expect(await run()).toBe(await run());
  });

  it("bots lose ties to humans in the standings", async () => {
    const sim = new Sim();
    const [me] = room(sim, 1);
    me.send({ type: "host.addBots" });
    me.send({ type: "host.config", rounds: 3, insider: false });
    me.send({ type: "host.start" });
    // nobody trades, so everyone without a royalty finishes on 0
    await sim.until("GAME_OVER", 900_000);
    const st = me.state!.standings;
    const zeros = st.filter((s) => s.score === 0 && s.royalties === 0);
    const firstBot = zeros.findIndex((s) => s.isBot);
    const human = zeros.findIndex((s) => !s.isBot);
    if (human >= 0 && firstBot >= 0) expect(human).toBeLessThan(firstBot);
  });

  it("the tell is posted at 30 s left and hints the least-dealt trait", async () => {
    const { sim, me } = await soloToMarket();
    const r = sim.engine.s.round!;
    await sim.advance(29_000);
    expect(me.tell).toBeNull();
    await sim.advance(2_000);
    expect(me.tell).not.toBeNull();
    const counts: Record<string, number> = {};
    for (const k of Object.values(r.clues)) counts[k] = (counts[k] ?? 0) + 1;
    const min = Math.min(...["loves", "hates", "quirk"].map((k) => counts[k] ?? 0));
    expect(counts[r.tellKind] ?? 0).toBe(min);
  });
});

describe("insider mode", () => {
  it("one player per round sees the full persona, never twice in a row, and the vote settles", async () => {
    const sim = new Sim();
    const cs = room(sim, 4);
    cs[0].send({ type: "host.config", rounds: 3, insider: true });
    cs[0].send({ type: "host.start" });
    const insiders: string[] = [];
    for (let r = 1; r <= 3; r++) {
      await sim.until("CLUE");
      const ins = cs.filter((c) => c.priv!.isInsider);
      expect(ins.length).toBe(1);
      expect(ins[0].priv!.fullPersona).not.toBeNull();
      for (const c of cs) if (c !== ins[0]) expect(c.priv!.fullPersona).toBeNull();
      insiders.push(ins[0].seatId!);
      await sim.until("SCOREBOARD", 300_000);
    }
    for (let i = 1; i < insiders.length; i++) expect(insiders[i]).not.toBe(insiders[i - 1]);
    await sim.until("GAME_OVER");
    const target = insiders[0];
    const before = sim.engine.s.seats.find((s) => s.id === target)!.score;
    for (const c of cs) c.send({ type: "insider.vote", seatId: c.seatId === target ? cs.find((x) => x.seatId !== target)!.seatId! : target });
    const res = cs[0].state!.insiderResults!;
    expect(res.length).toBe(3);
    const caughtRounds = res.filter((x) => x.insiderId === target);
    expect(caughtRounds.every((x) => x.caught)).toBe(true);
    const after = sim.engine.s.seats.find((s) => s.id === target)!.score;
    expect(after).toBeLessThanOrEqual(before);
  });
});

describe("custom judge", () => {
  it("host description becomes the persona for every round, flagged custom", async () => {
    const sim = new Sim(new FakeLlm());
    const [a] = room(sim, 3);
    a.send({ type: "host.config", rounds: 3, insider: false, customJudge: "our chem teacher" });
    await sim.settle();
    expect(a.state!.customReady).toBe("Judge Custom");
    a.send({ type: "host.start" });
    await sim.until("REVEAL");
    expect(a.reveal!.custom).toBe(true);
    expect(a.reveal!.persona.name).toBe("Judge Custom");
  });

  it("custom judge failure is rejected with a friendly message", async () => {
    const llm = new FakeLlm();
    llm.fail = true;
    const sim = new Sim(llm);
    const [a] = room(sim, 3);
    a.send({ type: "host.config", rounds: 3, insider: false, customJudge: "???" });
    await sim.settle();
    expect(a.state!.config.customJudge).toBeUndefined();
    expect(a.toasts.some((t) => /couldn't build/.test(t))).toBe(true);
  });
});
