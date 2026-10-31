import { useEffect, useState } from "react";
import { NICK_MAX, NICK_MIN, isValidCode } from "@mindshare/shared";
import { JudgeBlob } from "./components";
import { createRoom, roomInfo, store } from "./net";
import { Room } from "./Room";
import { Board } from "./Board";

export function navigate(path: string) {
  history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function usePath() {
  const [path, setPath] = useState(location.pathname + location.search);
  useEffect(() => {
    const on = () => setPath(location.pathname + location.search);
    window.addEventListener("popstate", on);
    return () => window.removeEventListener("popstate", on);
  }, []);
  return path;
}

export function App() {
  const path = usePath();
  const room = path.match(/^\/r\/([A-Za-z]{4})/);
  if (room) return <Room key={room[1].toUpperCase()} code={room[1].toUpperCase()} />;
  const board = path.match(/^\/board\/([A-Za-z]{4})/);
  if (board) return <Board code={board[1].toUpperCase()} />;
  return <Home />;
}

export function cleanNick(s: string) {
  return s.replace(/\s+/g, " ").trim().slice(0, NICK_MAX);
}

function Home() {
  const [nick, setNick] = useState(store.get("ms:nick") ?? "");
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get("join")?.toUpperCase() ?? "");
  const [busy, setBusy] = useState<null | "create" | "join" | "solo">(null);
  const [error, setError] = useState<string | null>(null);
  const nickOk = cleanNick(nick).length >= NICK_MIN;

  const remember = () => store.set("ms:nick", cleanNick(nick));

  async function create(solo: boolean) {
    if (!nickOk) return setError(`Pick a nickname first (${NICK_MIN} to ${NICK_MAX} letters).`);
    setError(null);
    setBusy(solo ? "solo" : "create");
    try {
      const c = await createRoom();
      remember();
      navigate(`/r/${c}${solo ? "?solo=1" : ""}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  async function join(e?: React.FormEvent) {
    e?.preventDefault();
    const c = code.trim().toUpperCase();
    if (!nickOk) return setError(`Pick a nickname first (${NICK_MIN} to ${NICK_MAX} letters).`);
    if (!isValidCode(c)) return setError("Room codes are 4 letters.");
    setError(null);
    setBusy("join");
    try {
      const info = await roomInfo(c);
      if (info.closed) throw new Error("That room has closed. Start a new one!");
      if (!info.exists) throw new Error("No room with that code. Check the letters and try again.");
      remember();
      navigate(`/r/${c}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  return (
    <main className="screen">
      <div className="row" style={{ marginTop: 8 }}>
        <JudgeBlob mood="smug" size={64} wobble />
        <div>
          <h1 className="logo">
            Mind<span>share</span>
          </h1>
        </div>
      </div>
      <p className="tagline">Write an answer. Bet on which one the AI judge will pick. You only get one clue about who the judge is.</p>

      <div className="stack">
        <div>
          <label className="lbl" htmlFor="nick">Your nickname</label>
          <input
            id="nick"
            className="field"
            value={nick}
            maxLength={NICK_MAX}
            autoComplete="nickname"
            placeholder="e.g. Sam"
            onChange={(e) => setNick(e.target.value)}
          />
        </div>
        <button className="btn primary big block" disabled={!!busy} onClick={() => create(true)}>
          {busy === "solo" ? "Setting the table…" : "Play solo with bots"}
        </button>
        <button className="btn block" disabled={!!busy} onClick={() => create(false)}>
          {busy === "create" ? "Creating…" : "Create a room for friends"}
        </button>
      </div>

      <div className="divider">or join a room</div>
      <form className="row" onSubmit={join}>
        <label className="sr-only" htmlFor="code">Room code</label>
        <input
          id="code"
          className="field codeinput grow"
          value={code}
          maxLength={4}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABCD"
          onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase())}
        />
        <button className="btn teal" type="submit" disabled={!!busy || code.length !== 4}>
          {busy === "join" ? "…" : "Join"}
        </button>
      </form>
      {error && <div className="banner err" role="alert">{error}</div>}

      <ol className="how">
        <li><span className="n">1</span><span><b>Get a clue</b> about the secret judge: what it loves, hates, or who it is.</span></li>
        <li><span className="n">2</span><span><b>Write an answer</b> to a prompt that judge will love.</span></li>
        <li><span className="n">3</span><span><b>Trade answers</b> on a live market. Prices are "% chance the judge picks it".</span></li>
        <li><span className="n">4</span><span><b>The reveal:</b> the judge rules, winning shares pay out, and everyone's secrets come out.</span></li>
      </ol>
      <p className="small faint center">3 to 10 phones · no login · play money only · about 12 minutes</p>
    </main>
  );
}
