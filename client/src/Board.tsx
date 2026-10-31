import { useMemo } from "react";
import qrcode from "qrcode-generator";
import { MARKET_MS, TELL_AT_REMAINING_MS, lmsrPrices } from "@mindshare/shared";
import { Countdown, JudgeBlob, ReplayChart } from "./components";
import type { Mood } from "./components";
import { useRoom } from "./net";

function Qr({ text }: { text: string }) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }, [text]);
  return <div className="qr" aria-label={`QR code to join: ${text}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

const PHASE_COPY: Record<string, string> = {
  LOBBY: "Join on your phone",
  SETUP: "A new judge takes the bench",
  CLUE: "Read your secret clue",
  WRITE: "Write your answer",
  MARKET: "Trading is open",
  VERDICT: "The judge is deciding…",
  REVEAL: "The reveal",
  SCOREBOARD: "Scores",
  GAME_OVER: "Final standings",
};

export function Board({ code }: { code: string }) {
  const conn = useRoom(code, "__board__", { board: true });
  const s = conn.state;
  const joinUrl = `${location.origin}/r/${code}`;
  if (conn.fatal) return <main className="screen"><p className="prompt">{conn.fatal}</p></main>;
  if (!s) return <main className="screen"><p className="dim">Connecting to {code}…</p></main>;
  const q = conn.q.length === s.tickers.length ? conn.q : s.q;
  const prices = q.length ? lmsrPrices(q, s.b) : [];
  const r = conn.reveal ?? s.reveal;
  const mood = (conn.tell?.mood ?? "neutral") as Mood;

  return (
    <main className="board">
      <aside className="side">
        <div>
          <div className="bsec">Room</div>
          <div className="bcode">{code}</div>
        </div>
        <Qr text={joinUrl} />
        <div className="dim" style={{ fontSize: "2.4vh" }}>{location.host}/r/{code}</div>
        <JudgeBlob size={160} mood={mood} wobble={s.phase === "VERDICT"} />
        {s.judgeName && <div style={{ fontSize: "3vh", fontWeight: 700 }}>{s.judgeName}</div>}
        {(s.phase === "REVEAL" || s.phase === "SCOREBOARD" || s.phase === "GAME_OVER" || s.phase === "LOBBY") && (
          <div>
            <div className="bsec">{s.phase === "LOBBY" ? "Players" : "Standings"}</div>
            {s.phase === "LOBBY"
              ? s.seats.map((x) => <div key={x.id} className="bline"><span>{x.nick}</span><span className="dim">{x.isBot ? "bot" : ""}</span></div>)
              : s.standings.slice(0, 8).map((x) => (
                  <div key={x.seatId} className="bline"><span>{x.nick}</span><span className="mono">{x.score > 0 ? "+" : ""}{x.score}</span></div>
                ))}
          </div>
        )}
        {s.audience.length > 0 && (
          <div>
            <div className="bsec">Crowd leaderboard</div>
            {s.audience.slice(0, 5).map((a) => (
              <div key={a.id} className="bline"><span>{a.nick}</span><span className="mono">{a.net > 0 ? "+" : ""}{Math.round(a.net)}</span></div>
            ))}
          </div>
        )}
      </aside>
      <section>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "2vh" }}>
          <div className="phase-big">{PHASE_COPY[s.phase]}</div>
          {s.phase !== "LOBBY" && s.phase !== "GAME_OVER" && <div className="dim" style={{ fontSize: "3vh" }}>Round {s.round}/{s.totalRounds}</div>}
        </div>
        {s.phaseEndsAt && <div style={{ marginBottom: "2vh" }}><Countdown endsAt={s.phaseEndsAt} offset={conn.offset} total={s.phase === "MARKET" ? MARKET_MS : Math.max(1000, s.phaseEndsAt - s.now)} /></div>}
        {s.prompt && <div className="big-prompt" style={{ marginBottom: "2.5vh" }}>{s.prompt}</div>}
        {s.tell && s.phase === "MARKET" && <div className="bubble" style={{ fontSize: "3.2vh", marginBottom: "2.5vh" }}>{s.tell.text}</div>}
        {s.tickers.map((t, i) => (
          <div key={t.ticker} className={"btk" + (r && r.winner === t.ticker ? " win" : "")}>
            <span className="l">{t.ticker}</span>
            <span>
              {t.text}
              {r && <span className="dim" style={{ fontSize: "2.4vh", display: "block" }}>{r.tickers[i]?.isDecoy ? "AI decoy" : r.tickers[i]?.authors.map((a) => a.nick).join(", ")}</span>}
            </span>
            <span className="p">{Math.round((prices[i] ?? 0) * 100)}%</span>
          </div>
        ))}
        {r && s.phase === "REVEAL" && (
          <div style={{ maxWidth: "60vw" }}>
            <div className="bubble" style={{ fontSize: "3vh", margin: "2vh 0" }}>{r.reason}</div>
            <div style={{ fontSize: "2.6vh" }} className="dim">
              {r.persona.name} is {r.persona.identity.text}; loves {r.persona.loves.text}; hates {r.persona.hates.text}; {r.persona.quirk.text}.
            </div>
            <ReplayChart history={r.priceHistory} letters={r.tickers.map((t) => t.ticker)} winner={r.winner} durationMs={MARKET_MS} tellAtMs={MARKET_MS - TELL_AT_REMAINING_MS} />
          </div>
        )}
      </section>
    </main>
  );
}
