import { useMemo, useState } from "react";
import { MARKET_MS, TELL_AT_REMAINING_MS, commitHash } from "@mindshare/shared";
import type { Standing } from "@mindshare/shared";
import { Avatar, Confetti, Countdown, JudgeSays, ReplayChart, Signed } from "./components";
import type { Mood } from "./components";
import type { RoomConn } from "./net";
import { shareCard } from "./share";

export function Reveal({ conn, isHost, commitSeen, total }: { conn: RoomConn; isHost: boolean; commitSeen: string | null; total: number }) {
  const s = conn.state!;
  const r = conn.reveal ?? s.reveal;
  const verified = useMemo(() => {
    if (!r) return false;
    const h = commitHash(r.persona, r.seed);
    return h === r.commit && (commitSeen == null || commitSeen === h);
  }, [r, commitSeen]);
  if (!r) return <p className="dim">Revealing…</p>;
  const win = r.tickers.find((t) => t.ticker === r.winner)!;
  const me = r.pnl.find((p) => p.seatId === conn.seatId);
  const myClue = conn.priv?.clue?.kind;
  const mood: Mood = me && me.roundScore > 0 ? "delighted" : "smug";
  const winAuthor = win.authors[0];

  return (
    <>
      <Countdown endsAt={s.phaseEndsAt} offset={conn.offset} total={total} />
      <div className="winner" aria-live="polite">
        <div className="lbl2">The judge picks {r.winner}</div>
        <div className="t">{win.text}</div>
        <div className="small dim">
          {win.isDecoy ? "An AI decoy! Nobody gets the royalty." : `Written by ${winAuthor?.nick}${winAuthor?.isBot ? " (bot)" : ""} · +30 royalty`}
        </div>
      </div>
      <JudgeSays mood={mood} text={r.reason} name={r.persona.name} />
      <div className="row" style={{ flexWrap: "wrap" }}>
        {r.fallback && <span className="badge warn" title="The AI judge was slow or unavailable, so the keyword judge decided.">fallback judge</span>}
        {r.custom && <span className="badge">custom judge</span>}
        {r.tutorial && <span className="badge">practice round · half points</span>}
        {me && <span className="badge">you: <Signed n={me.roundScore} /></span>}
      </div>

      <section className="card stack" aria-label="The judge, revealed">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700 }}>{r.persona.name}</div>
            {r.persona.voice && <div className="small dim">{r.persona.voice}</div>}
          </div>
          {verified ? (
            <span className="badge ok" title="sha256(judge + seed) matches the lock shown before trading">✓ verified</span>
          ) : (
            <span className="badge bad">✗ hash mismatch</span>
          )}
        </div>
        <ul className="traits">
          <li className={myClue === "identity" ? "yours" : ""}><span className="k">Is</span><span>{r.persona.identity.text}</span></li>
          <li className={myClue === "loves" ? "yours" : ""}><span className="k">Loves</span><span>{r.persona.loves.text}</span></li>
          <li className={myClue === "hates" ? "yours" : ""}><span className="k">Hates</span><span>{r.persona.hates.text}</span></li>
          <li className={myClue === "quirk" ? "yours" : ""}><span className="k">Quirk</span><span>{r.persona.quirk.text}</span></li>
        </ul>
        {r.persona.custom && r.persona.description && <div className="small dim">Built from: “{r.persona.description}”</div>}
        <details>
          <summary className="small dim" style={{ cursor: "pointer" }}>How do I know it didn't change?</summary>
          <p className="small dim">
            Before the market opened, everyone saw a lock: sha256 of the judge plus a secret seed. Your phone just re-computed it from the revealed judge and seed.
          </p>
          <p className="hash">seed {r.seed}<br />lock {r.commit}</p>
        </details>
      </section>

      <h2 className="sec">Who wrote what</h2>
      <ul className="answers">
        {r.tickers.map((t) => (
          <li key={t.ticker} className={t.ticker === r.winner ? "win" : ""}>
            <span className="mono" style={{ color: "var(--amber)", fontWeight: 800 }}>{t.ticker}</span>
            <span>{t.text}</span>
            <span className="who">
              {t.isDecoy ? <span className="tag bot">AI decoy</span> : t.authors.map((a) => a.nick + (a.isBot ? " 🤖" : "")).join(", ")}
            </span>
          </li>
        ))}
        {r.noAnswer.map((n) => (
          <li key={n.seatId} className="faint">
            <span />
            <span>{n.text}</span>
            <span className="who">{n.nick}</span>
          </li>
        ))}
      </ul>

      <h2 className="sec">Price replay</h2>
      <ReplayChart
        history={r.priceHistory}
        letters={r.tickers.map((t) => t.ticker)}
        winner={r.winner}
        durationMs={MARKET_MS}
        tellAtMs={MARKET_MS - TELL_AT_REMAINING_MS}
      />

      <h2 className="sec">This round</h2>
      <ul className="pnl">
        {r.pnl.map((p) => (
          <li key={p.seatId} className={p.seatId === conn.seatId ? "me" : ""}>
            <span className="row grow" style={{ minWidth: 0 }}>
              <Avatar nick={p.nick} id={p.seatId} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.nick}
                {p.isBot && <span className="tag bot" style={{ marginLeft: 6 }}>bot</span>}
                {p.insider && <span className="tag host" style={{ marginLeft: 6 }}>insider</span>}
              </span>
            </span>
            <span className="small dim mono">{p.holdings[r.tickers.findIndex((t) => t.ticker === r.winner)] || 0} {r.winner}</span>
            <Signed n={p.roundScore} />
          </li>
        ))}
      </ul>
      {r.audience.length > 0 && (
        <>
          <h2 className="sec">Crowd{r.crowdPick ? ` · pick ${r.crowdPick}` : ""}</h2>
          <ul className="pnl">
            {r.audience.slice(0, 5).map((a) => (
              <li key={a.id} className={a.id === conn.seatId ? "me" : ""}><span>{a.nick}</span><Signed n={a.net} /></li>
            ))}
          </ul>
        </>
      )}
      {isHost && (
        <div className="row">
          <button className="btn grow" onClick={() => conn.send({ type: "host.extend" })}>+20 s</button>
          <button className="btn primary grow" onClick={() => conn.send({ type: "host.skip" })}>Scores</button>
        </div>
      )}
    </>
  );
}

function StandingsList({ standings, meId, deltas }: { standings: Standing[]; meId: string | null; deltas?: boolean }) {
  return (
    <ol className="standings">
      {standings.map((x, i) => (
        <li key={x.seatId} className={i === 0 ? "first" : ""} style={x.seatId === meId ? { outline: "1px solid var(--amber)" } : undefined}>
          <span className="rank">{i + 1}</span>
          <span className="row" style={{ minWidth: 0 }}>
            <Avatar nick={x.nick} id={x.seatId} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.nick}</span>
            {x.isBot && <span className="tag bot">bot</span>}
          </span>
          <span className="row">
            {deltas && x.rounds.length > 0 && <span className="small"><Signed n={x.rounds[x.rounds.length - 1]} /></span>}
            <span className="sc">{x.score > 0 ? `+${x.score}` : x.score}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Scoreboard({ conn, isHost, total }: { conn: RoomConn; isHost: boolean; total: number }) {
  const s = conn.state!;
  const last = s.round >= s.totalRounds;
  return (
    <>
      <Countdown endsAt={s.phaseEndsAt} offset={conn.offset} total={total} />
      <h2 className="prompt">{last ? "Final round done" : `After round ${s.round} of ${s.totalRounds}`}</h2>
      <StandingsList standings={s.standings} meId={conn.seatId} deltas />
      <p className="small dim">Scores are play-money credits earned each round, added up. Everyone starts every round with a fresh 100.</p>
      {isHost ? (
        <button className="btn primary big block" onClick={() => conn.send({ type: "host.skip" })}>
          {last ? "Final results" : "Next round"}
        </button>
      ) : (
        <p className="dim center">{last ? "Final results coming up…" : "Next round starts automatically."}</p>
      )}
    </>
  );
}

export function GameOver({ conn, isHost }: { conn: RoomConn; isHost: boolean }) {
  const s = conn.state!;
  const p = conn.priv!;
  const st = s.standings;
  const [sharing, setSharing] = useState(false);
  const voting = s.config.insider && !s.insiderResults && conn.role === "player";
  return (
    <>
      <Confetti />
      <div className="center">
        <div className="small dim">Game over</div>
        <h1 className="prompt" style={{ marginTop: 4 }}>{st[0] ? `${st[0].nick} wins!` : "Game over"}</h1>
      </div>
      <StandingsList standings={st} meId={conn.seatId} />

      {voting && (
        <section className="card stack" aria-label="Insider vote">
          <div style={{ fontWeight: 700 }}>Who was the Insider most often?</div>
          <div className="small dim">Catch them by majority and they lose their Insider rounds' winnings. Miss, and they get +20 per round.</div>
          <div className="players" style={{ display: "grid" }}>
            {s.seats.filter((x) => x.id !== conn.seatId && !x.away).map((x) => (
              <button key={x.id} className={"btn" + (p.insiderVote === x.id ? " primary" : "")} onClick={() => conn.send({ type: "insider.vote", seatId: x.id })}>
                {x.nick}
              </button>
            ))}
          </div>
          <div className="small dim">{s.insiderVotes} vote{s.insiderVotes === 1 ? "" : "s"} in</div>
          {isHost && <button className="linkbtn" onClick={() => conn.send({ type: "host.skip" })}>Close the vote</button>}
        </section>
      )}
      {s.insiderResults && (
        <section className="card stack" aria-label="Insider results">
          <div style={{ fontWeight: 700 }}>The Insiders</div>
          {s.insiderResults.map((r) => (
            <div key={r.round} className="row small">
              <span className="mono dim">R{r.round}</span>
              <span className="grow">{r.insiderNick}</span>
              {r.caught ? <span className="badge bad">caught</span> : <span className="badge ok">got away · +20</span>}
            </div>
          ))}
        </section>
      )}

      <div className="row">
        <button
          className="btn grow"
          disabled={sharing}
          onClick={async () => {
            setSharing(true);
            try {
              await shareCard(s, conn.seatId);
            } finally {
              setSharing(false);
            }
          }}
        >
          {sharing ? "Drawing…" : "Share card"}
        </button>
        {isHost ? (
          <button className="btn primary grow" onClick={() => conn.send({ type: "host.start" })}>Play again</button>
        ) : (
          <span className="small dim grow center">Waiting for the host to play again…</span>
        )}
      </div>
      <p className="small faint center">Play again keeps the room and deals new judges and prompts.</p>
    </>
  );
}
