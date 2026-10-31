import { useEffect, useRef, useState } from "react";
import {
  AUDIENCE_B,
  LONG_PRESS_MS,
  MARKET_MS,
  MAX_SHARES_PER_OUTCOME,
  TRADE_SIZE_LONG,
  TRADE_SIZE_TAP,
  lmsrPrices,
  tradeCost,
} from "@mindshare/shared";
import { Countdown, JudgeSays, LINE_COLORS, Sparkline } from "./components";
import type { Mood } from "./components";
import type { RoomConn } from "./net";
import { ClueChip } from "./Room";
import { sound } from "./sound";

export function Market({ conn, audience, soundOn }: { conn: RoomConn; audience: boolean; soundOn: boolean }) {
  const s = conn.state!;
  const p = conn.priv!;
  const q = audience ? s.audienceQ : conn.q.length === s.tickers.length ? conn.q : s.q;
  const b = audience ? AUDIENCE_B : s.b;
  const prices = q.length ? lmsrPrices(q, b) : s.tickers.map(() => 1 / Math.max(1, s.tickers.length));
  const holdings = p.holdings.length === s.tickers.length ? p.holdings : s.tickers.map(() => 0);
  const cash = p.cash;
  const net = cash + holdings.reduce((a, h, i) => a + h * (prices[i] ?? 0), 0);
  const [history, setHistory] = useState<number[][]>(() => s.priceHistory.map((h) => h.p));
  const prev = useRef<number[]>(prices);
  const [dir, setDir] = useState<number[]>([]);
  const canTrade = audience || !!p.clue;
  const left = s.marketEndsAt ? s.marketEndsAt - (Date.now() + conn.offset) : 1;
  const frozen = left <= 0;

  // local price history for sparklines (the state snapshot only carries it on phase changes)
  const qKey = q.join(",");
  useEffect(() => {
    const now = lmsrPrices(q.length ? q : [0], b);
    setHistory((h) => [...h.slice(-80), now]);
    setDir(now.map((x, i) => Math.sign(x - (prev.current[i] ?? x))));
    prev.current = now;
    const t = setTimeout(() => setDir([]), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qKey]);

  const trade = (i: number, side: "buy" | "sell", qty: number) => {
    if (frozen) return;
    const ticker = s.tickers[i].ticker;
    if (side === "buy") {
      let k = qty;
      while (k > 0 && (tradeCost(q, b, i, k) > cash + 1e-9 || holdings[i] + k > MAX_SHARES_PER_OUTCOME)) k--;
      if (k <= 0) return;
      conn.send({ type: "market.trade", ticker, side, qty: k, expectedCost: tradeCost(q, b, i, k) });
    } else {
      const k = Math.min(qty, holdings[i]);
      if (k <= 0) return;
      conn.send({ type: "market.trade", ticker, side, qty: k, expectedCost: tradeCost(q, b, i, -k) });
    }
    if (soundOn) sound.tick();
    if (navigator.vibrate) navigator.vibrate(8);
  };

  return (
    <>
      <Countdown endsAt={s.phaseEndsAt} offset={conn.offset} total={MARKET_MS} />
      {s.tell ? (
        <JudgeSays mood={s.tell.mood as Mood} text={s.tell.text} name={s.judgeName} tell compact />
      ) : (
        <p className="small dim" style={{ margin: 0 }}>
          {s.judgeName} will drop a hint at 0:30. <span className="faint">{s.prompt}</span>
        </p>
      )}
      {!audience && <ClueChip conn={conn} />}
      {audience && (
        <div className="banner">You're in the crowd market with your own credits. Vote for a crowd pick: its author gets +10.</div>
      )}
      {p.notes.map((n) => (
        <div key={n} className="banner err">{n}</div>
      ))}
      <ul className="tickers" aria-label="Answers on the market">
        {s.tickers.map((t, i) => {
          const pct = Math.round((prices[i] ?? 0) * 100);
          const buyCost = tradeCost(q, b, i, TRADE_SIZE_TAP);
          const canBuy = canTrade && !frozen && buyCost <= cash + 1e-9 && holdings[i] < MAX_SHARES_PER_OUTCOME;
          const canSell = canTrade && !frozen && holdings[i] > 0;
          return (
            <li key={t.ticker} className={"tk" + (holdings[i] > 0 ? " held" : "")}>
              <span className="l" aria-hidden="true">{t.ticker}</span>
              <span className="t">{t.text}</span>
              <span className={"p" + (dir[i] > 0 ? " up" : dir[i] < 0 ? " down" : "")} aria-label={`${pct} percent chance`}>
                {pct}%
              </span>
              <span className="s">
                <Sparkline points={history.map((h) => h[i] ?? 0)} color={LINE_COLORS[i % LINE_COLORS.length]} />
                <span className="held-n">{holdings[i] > 0 ? `you hold ${holdings[i]}` : ""}</span>
                {audience && (
                  <button
                    className={"vote" + (p.crowdVote === t.ticker ? " on" : "")}
                    aria-pressed={p.crowdVote === t.ticker}
                    onClick={() => conn.send({ type: "audience.vote", ticker: t.ticker })}
                  >
                    {p.crowdVote === t.ticker ? "crowd pick ✓" : "vote"}
                    {s.crowdVotes[t.ticker] ? ` · ${s.crowdVotes[t.ticker]}` : ""}
                  </button>
                )}
              </span>
              <span className="b">
                <TradeButton label="−" kind="sell" disabled={!canSell} aria={`Sell one share of ${t.ticker}. Hold to sell five.`} onTrade={(n) => trade(i, "sell", n)} />
                <TradeButton
                  label="+"
                  kind="buy"
                  cost={canTrade ? buyCost : undefined}
                  disabled={!canBuy}
                  aria={`Buy one share of ${t.ticker} for about ${buyCost.toFixed(1)} credits. Hold to buy five.`}
                  onTrade={(n) => trade(i, "buy", n)}
                />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="small faint center" style={{ margin: 0 }}>
        Tap to trade 1 share, hold for 5. Each share of the winner pays 1 credit.
      </p>
      {canTrade && (
        <div className="footer" aria-live="off">
          <div>
            <div className="k">Cash</div>
            <div className="v">{cash.toFixed(1)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="k">Worth now (est.)</div>
            <div className="v" style={{ color: net >= 100 ? "var(--amber)" : "var(--teal)" }}>{net.toFixed(1)}</div>
          </div>
        </div>
      )}
    </>
  );
}

function TradeButton({ label, kind, cost, disabled, aria, onTrade }: { label: string; kind: "buy" | "sell"; cost?: number; disabled: boolean; aria: string; onTrade: (qty: number) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = () => {
    if (disabled) return;
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onTrade(TRADE_SIZE_LONG);
    }, LONG_PRESS_MS);
  };
  const end = (commit: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (commit && !fired.current && !disabled) onTrade(TRADE_SIZE_TAP);
    fired.current = true;
  };
  return (
    <button
      className={"tradebtn " + kind}
      disabled={disabled}
      aria-label={aria}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        start();
      }}
      onPointerUp={() => end(true)}
      onPointerLeave={() => end(false)}
      onPointerCancel={() => end(false)}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!e.repeat) onTrade(e.shiftKey ? TRADE_SIZE_LONG : TRADE_SIZE_TAP);
        }
      }}
    >
      <span style={{ marginTop: cost != null ? -8 : 0 }}>{label}</span>
      {cost != null && !disabled && <span className="cost">{cost.toFixed(1)}</span>}
    </button>
  );
}
