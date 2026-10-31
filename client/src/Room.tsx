import { useEffect, useRef, useState } from "react";
import {
  ANSWER_MAX,
  CLUE_MS,
  MAX_PLAYERS,
  MIN_SEATS,
  NICK_MAX,
  NICK_MIN,
  REVEAL_MS,
  ROUND_OPTIONS,
  SCOREBOARD_MS,
  VERDICT_MAX_MS,
  WRITE_MS,
} from "@mindshare/shared";
import type { PublicState } from "@mindshare/shared";
import { cleanNick, navigate } from "./App";
import { Avatar, Countdown, JudgeBlob, Toasts } from "./components";
import type { RoomConn } from "./net";
import { store, useRoom } from "./net";
import { Market } from "./Market";
import { GameOver, Reveal, Scoreboard } from "./Reveal";
import { sound, useSoundPref } from "./sound";

export function Room({ code }: { code: string }) {
  const [nick, setNick] = useState<string | null>(() => store.get("ms:nick"));
  const params = new URLSearchParams(location.search);
  const watch = params.get("watch") === "1";
  if (!nick) return <NickPrompt code={code} onDone={setNick} />;
  return <RoomInner code={code} nick={nick} watch={watch} solo={params.get("solo") === "1"} />;
}

function NickPrompt({ code, onDone }: { code: string; onDone: (n: string) => void }) {
  const [v, setV] = useState("");
  const ok = cleanNick(v).length >= NICK_MIN;
  return (
    <main className="screen">
      <h1 className="logo">Mind<span>share</span></h1>
      <p className="tagline">You're joining room <b className="mono">{code}</b>.</p>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          store.set("ms:nick", cleanNick(v));
          onDone(cleanNick(v));
        }}
      >
        <label className="lbl" htmlFor="nick2">Pick a nickname</label>
        <input id="nick2" className="field" autoFocus value={v} maxLength={NICK_MAX} onChange={(e) => setV(e.target.value)} />
        <button className="btn primary big" disabled={!ok}>Join room</button>
      </form>
    </main>
  );
}

function RoomInner({ code, nick, watch, solo }: { code: string; nick: string; watch: boolean; solo: boolean }) {
  const conn = useRoom(code, nick, { audience: watch });
  const { state, priv, fatal, status } = conn;
  const [soundOn, setSoundOn] = useSoundPref();
  const soloSent = useRef(false);
  const commitSeen = useRef<Record<number, string>>({});

  // Remember the hash we were shown before trading, so the reveal can prove it didn't change.
  if (state?.commit && state.phase !== "REVEAL" && state.phase !== "SCOREBOARD") commitSeen.current[state.round] ??= state.commit;

  const isHost = !!state && !!conn.seatId && state.hostId === conn.seatId;

  // Solo: once we're the host in a fresh lobby, fill the table with bots.
  useEffect(() => {
    if (!solo || soloSent.current || !state || !isHost || state.phase !== "LOBBY") return;
    soloSent.current = true;
    if (state.seats.length < 4) conn.send({ type: "host.addBots" });
    history.replaceState(null, "", `/r/${code}`);
  }, [solo, state, isHost, conn, code]);

  // sounds
  const prevPhase = useRef<string | null>(null);
  useEffect(() => {
    if (!state || !soundOn) {
      prevPhase.current = state?.phase ?? null;
      return;
    }
    if (prevPhase.current === "MARKET" && state.phase === "VERDICT") sound.bell();
    if (prevPhase.current === "VERDICT" && state.phase === "REVEAL" && conn.reveal) {
      const me = conn.reveal.pnl.find((p) => p.seatId === conn.seatId);
      if (me && me.roundScore > 0) sound.cheer();
      else sound.groan();
    }
    prevPhase.current = state.phase;
  }, [state, soundOn, conn.reveal, conn.seatId]);

  if (fatal) {
    return (
      <main className="screen">
        <div className="verdict">
          <JudgeBlob mood="grumpy" size={96} />
          <p className="prompt">{fatal}</p>
          <button className="btn primary" onClick={() => navigate("/")}>Back to start</button>
        </div>
      </main>
    );
  }

  if (!state || !priv) {
    return (
      <main className="screen">
        <div className="verdict">
          <JudgeBlob size={80} wobble />
          <p className="dim">{status === "reconnecting" ? "Reconnecting…" : `Joining ${code}…`}</p>
        </div>
      </main>
    );
  }

  const audience = conn.role === "audience";

  return (
    <main className="screen">
      <Toasts toasts={conn.toasts} dismiss={conn.dismiss} />
      <header className="topbar">
        <button className="linkbtn" style={{ padding: 0 }} onClick={() => navigate("/")} aria-label="Leave to home screen">
          <JudgeBlob size={34} mood={conn.tell ? (conn.tell.mood as "neutral") : "neutral"} />
        </button>
        <span className="code" aria-label={`Room code ${code}`}>{code}</span>
        {state.phase !== "LOBBY" && state.phase !== "GAME_OVER" && (
          <span className="round">
            Round {state.round}/{state.totalRounds}
            {state.tutorialRound ? " · practice" : ""}
          </span>
        )}
        <span className="grow" />
        {audience && <span className="tag">audience</span>}
        {status !== "open" && <span className="status-pill">reconnecting…</span>}
        <button
          className="iconbtn"
          onClick={() => {
            setSoundOn(!soundOn);
            if (!soundOn) sound.tick();
          }}
          aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
          aria-pressed={soundOn}
        >
          {soundOn ? "🔊" : "🔈"}
        </button>
      </header>
      <PhaseView conn={conn} isHost={isHost} audience={audience} soundOn={soundOn} commitSeen={commitSeen.current[state.round] ?? null} />
      <Tutorial state={state} />
    </main>
  );
}

function PhaseView({ conn, isHost, audience, soundOn, commitSeen }: { conn: RoomConn; isHost: boolean; audience: boolean; soundOn: boolean; commitSeen: string | null }) {
  const state = conn.state!;
  switch (state.phase) {
    case "LOBBY":
      return <Lobby conn={conn} isHost={isHost} />;
    case "SETUP":
      return (
        <div className="verdict">
          <JudgeBlob size={120} wobble />
          <p className="prompt">A new judge takes the bench.</p>
          <p className="dim">Round {state.round} of {state.totalRounds}</p>
        </div>
      );
    case "CLUE":
      return <Clue conn={conn} audience={audience} isHost={isHost} />;
    case "WRITE":
      return <Write conn={conn} audience={audience} isHost={isHost} />;
    case "MARKET":
      return <Market conn={conn} audience={audience} soundOn={soundOn} />;
    case "VERDICT":
      return (
        <div className="verdict">
          <Countdown endsAt={state.phaseEndsAt} offset={conn.offset} total={VERDICT_MAX_MS} />
          <JudgeBlob size={130} mood="neutral" wobble />
          <p className="prompt">The judge is deciding.</p>
          <div className="drum" aria-hidden="true"><span /><span /><span /></div>
          <p className="small dim">Trading is closed. No take-backs.</p>
        </div>
      );
    case "REVEAL":
      return <Reveal conn={conn} isHost={isHost} commitSeen={commitSeen} total={REVEAL_MS} />;
    case "SCOREBOARD":
      return <Scoreboard conn={conn} isHost={isHost} total={SCOREBOARD_MS} />;
    case "GAME_OVER":
      return <GameOver conn={conn} isHost={isHost} />;
  }
}

// ---------- lobby ----------

function Lobby({ conn, isHost }: { conn: RoomConn; isHost: boolean }) {
  const s = conn.state!;
  const seats = s.seats;
  const humans = seats.filter((x) => !x.isBot).length;
  const [copied, setCopied] = useState(false);
  const [custom, setCustom] = useState(s.config.customJudge ?? "");
  const link = `${location.origin}/r/${s.code}`;
  const config = (patch: Partial<PublicState["config"]>) =>
    conn.send({
      type: "host.config",
      rounds: patch.rounds ?? s.config.rounds,
      insider: patch.insider ?? s.config.insider,
      tutorial: patch.tutorial ?? s.config.tutorial,
      customJudge: patch.customJudge !== undefined ? patch.customJudge : s.config.customJudge,
    });

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: "Mindshare", text: `Join my Mindshare room: ${s.code}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <>
      <div className="center">
        <div className="small dim">Room code</div>
        <div className="bigcode">{s.code}</div>
        <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
          <button className="btn ghost small" onClick={share}>{copied ? "Link copied" : "Share invite link"}</button>
          <a className="btn ghost small" href={`/board/${s.code}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            Open board on a TV
          </a>
        </div>
      </div>

      <section aria-label="Players">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <h2 className="sec">Players · {seats.length}/{MAX_PLAYERS}</h2>
          {s.audienceCount > 0 && <span className="small dim">{s.audienceCount} watching</span>}
        </div>
        <ul className="players">
          {seats.map((p) => (
            <li key={p.id} className={"player" + (p.connected ? "" : " off")}>
              <Avatar nick={p.nick} id={p.id} />
              <span className="nick">{p.nick}{p.id === conn.seatId ? " (you)" : ""}</span>
              {p.id === s.hostId && <span className="tag host">host</span>}
              {p.isBot && <span className="tag bot">bot</span>}
              {isHost && p.id !== conn.seatId && (
                <button className="linkbtn" style={{ padding: "0 4px", minHeight: 32 }} aria-label={`Remove ${p.nick}`} onClick={() => conn.send({ type: "host.kick", seatId: p.id })}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <section className="card stack" aria-label="Host controls">
          <button className="btn primary big block" disabled={seats.length < MIN_SEATS || s.customPending} onClick={() => conn.send({ type: "host.start" })}>
            {seats.length < MIN_SEATS ? `Need ${MIN_SEATS - seats.length} more (or add bots)` : "Start game"}
          </button>
          <div>
            <div className="lbl">Rounds</div>
            <div className="seg" role="radiogroup" aria-label="Rounds">
              {ROUND_OPTIONS.map((n) => (
                <button key={n} role="radio" aria-checked={s.config.rounds === n} className={"btn" + (s.config.rounds === n ? " on" : "")} onClick={() => config({ rounds: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="toggle">
            <div>
              <div>Insider mode</div>
              <div className="small dim">Each round one player secretly sees the whole judge. Unmask them at the end.</div>
            </div>
            <button role="switch" aria-checked={s.config.insider} aria-label="Insider mode" className="switch" onClick={() => config({ insider: !s.config.insider })} />
          </div>
          {s.gamesPlayed > 0 && (
            <div className="toggle">
              <div>
                <div>Practice round</div>
                <div className="small dim">Round 1 counts half and shows tips.</div>
              </div>
              <button role="switch" aria-checked={s.config.tutorial} aria-label="Practice round" className="switch" onClick={() => config({ tutorial: !s.config.tutorial })} />
            </div>
          )}
          <details>
            <summary className="small dim" style={{ cursor: "pointer", minHeight: 32 }}>Custom judge (optional)</summary>
            <form
              className="row"
              style={{ marginTop: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                config({ customJudge: custom.trim() || undefined });
              }}
            >
              <label className="sr-only" htmlFor="custom">Describe your judge</label>
              <input id="custom" className="field grow" placeholder="e.g. our chemistry teacher" maxLength={200} value={custom} onChange={(e) => setCustom(e.target.value)} />
              <button className="btn" type="submit">Set</button>
            </form>
            <div className="small dim" style={{ marginTop: 6 }}>
              {s.customPending ? "Building your judge…" : s.customReady ? `Ready: ${s.customReady} judges every round.` : "Leave empty for a random judge each round."}
              {s.customReady && (
                <button className="linkbtn" onClick={() => { setCustom(""); config({ customJudge: undefined }); }}>clear</button>
              )}
            </div>
          </details>
          <div className="row">
            {seats.length < MAX_PLAYERS && (
              <button className="btn grow" onClick={() => conn.send({ type: "host.addBots" })}>
                {seats.length < 4 ? "Add bots" : "Add a bot"}
              </button>
            )}
            {seats.some((x) => x.isBot) && (
              <button className="btn ghost" onClick={() => conn.send({ type: "host.removeBots" })}>Remove bots</button>
            )}
          </div>
          {humans < MIN_SEATS && seats.length >= MIN_SEATS && <div className="small dim center">Bots fill empty seats. Friends can still join until you start.</div>}
        </section>
      ) : (
        <div className="card center dim">
          {conn.role === "audience" ? "You're watching. You'll get a crowd wallet and a vote each round." : "Waiting for the host to start…"}
        </div>
      )}
    </>
  );
}

// ---------- clue ----------

const KIND_LABEL = { identity: "who the judge is", loves: "what the judge loves", hates: "what the judge hates", quirk: "the judge's quirk" } as const;

export function ClueChip({ conn }: { conn: RoomConn }) {
  const clue = conn.priv?.clue;
  if (!clue) return null;
  return (
    <div className="cluechip">
      Your clue: <b>{clue.text.replace(/^The judge /, "the judge ")}</b>
    </div>
  );
}

function Clue({ conn, audience, isHost }: { conn: RoomConn; audience: boolean; isHost: boolean }) {
  const s = conn.state!;
  const p = conn.priv!;
  const acked = s.seats.find((x) => x.id === conn.seatId)?.acked;
  if (audience || !p.clue) {
    return (
      <div className="verdict">
        <JudgeBlob size={110} />
        <p className="prompt">Players are reading their secret clues.</p>
        <p className="hash">Judge locked: {s.commit}</p>
      </div>
    );
  }
  return (
    <>
      <Countdown endsAt={s.phaseEndsAt} offset={conn.offset} total={CLUE_MS} />
      <div className="cluecard">
        <div className="k">Your secret clue · {KIND_LABEL[p.clue.kind]}</div>
        <div className="t">{p.clue.text}.</div>
        <div className="small dim">Keep it secret or share it. Your call.</div>
      </div>
      {p.isInsider && p.fullPersona && (
        <div className="card">
          <div className="small" style={{ color: "var(--amber)", fontWeight: 700 }}>You're the Insider this round. Act natural.</div>
          <ul className="traits" style={{ marginTop: 8 }}>
            <li><span className="k">Is</span><span>{p.fullPersona.identity.text}</span></li>
            <li><span className="k">Loves</span><span>{p.fullPersona.loves.text}</span></li>
            <li><span className="k">Hates</span><span>{p.fullPersona.hates.text}</span></li>
            <li><span className="k">Quirk</span><span>{p.fullPersona.quirk.text}</span></li>
          </ul>
        </div>
      )}
      <button className="btn primary big block" disabled={acked} onClick={() => conn.send({ type: "clue.ack" })} autoFocus>
        {acked ? "Waiting for the others…" : "Got it"}
      </button>
      <p className="small dim center">{s.judgeName} is locked in before anyone trades.</p>
      <p className="hash center" title="sha256 of the judge and a secret seed">lock: {s.commit?.slice(0, 16)}…</p>
      {isHost && <button className="linkbtn" onClick={() => conn.send({ type: "host.skip" })}>Skip ahead</button>}
    </>
  );
}

// ---------- write ----------

function Write({ conn, audience, isHost }: { conn: RoomConn; audience: boolean; isHost: boolean }) {
  const s = conn.state!;
  const p = conn.priv!;
  const [text, setText] = useState("");
  const inRound = !audience && !!p.clue;
  const submitted = s.seats.filter((x) => x.submitted).length;
  const expected = s.seats.filter((x) => !x.away).length;
  const submit = () => {
    const t = text.trim();
    if (t) conn.send({ type: "write.submit", text: t });
  };
  return (
    <>
      <Countdown endsAt={s.phaseEndsAt} offset={conn.offset} total={WRITE_MS} />
      <p className="prompt">{s.prompt}</p>
      {inRound && <ClueChip conn={conn} />}
      {!inRound ? (
        <div className="card dim">Players are writing answers. The market opens in a moment.</div>
      ) : p.submitted ? (
        <div className="card">
          <div className="small dim">Locked in</div>
          <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>{p.submitted}</div>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="sr-only" htmlFor="answer">Your answer</label>
          <textarea
            id="answer"
            className="field"
            autoFocus
            maxLength={ANSWER_MAX}
            value={text}
            placeholder="Write something this judge would love…"
            enterKeyHint="send"
            onChange={(e) => setText(e.target.value.replace(/\n/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="row">
            <span className={"counter grow" + (text.length > ANSWER_MAX - 10 ? " warn" : "")} style={{ textAlign: "left" }}>
              {text.length}/{ANSWER_MAX}
            </span>
            <button className="btn primary" type="submit" disabled={!text.trim()}>Submit</button>
          </div>
        </form>
      )}
      <div className="row">
        <div className="dots" aria-hidden="true">
          {s.seats.filter((x) => !x.away).map((x) => (
            <span key={x.id} className={"dot" + (x.submitted ? " on" : "")} title={x.nick} />
          ))}
        </div>
        <span className="small dim">{submitted} of {expected} submitted</span>
      </div>
      <p className="small faint">Answers go on the market anonymously, mixed with a couple of AI decoys.</p>
      {isHost && <button className="linkbtn" onClick={() => conn.send({ type: "host.skip" })}>End writing now</button>}
    </>
  );
}

// ---------- tutorial ----------

const TUTORIAL: Record<string, [number, string]> = {
  WRITE: [1, "Write the answer you think this judge would pick; your clue is a hint."],
  MARKET: [2, "Tap + to buy answers you think will win; each winning share pays 1 credit, and prices show the room's best guess."],
  REVEAL: [3, "The judge was locked in before anyone traded, and the green check proves it."],
};

function Tutorial({ state }: { state: PublicState }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  if (!state.tutorialRound) return null;
  const step = TUTORIAL[state.phase];
  if (!step || hidden[state.phase]) return null;
  return (
    <div className="tutorial" role="note">
      <span className="step">{step[0]}/3</span>
      <span className="grow small" style={{ fontWeight: 600 }}>{step[1]}</span>
      <button onClick={() => setHidden((h) => ({ ...h, [state.phase]: true }))} aria-label="Dismiss tip">OK</button>
    </div>
  );
}
