import { useCallback, useEffect, useRef, useState } from "react";
import { RECONNECT_BASE_MS, RECONNECT_MAX_MS } from "@mindshare/shared";
import type { ClientMessage, PrivateState, PublicState, RevealData, ServerMessage } from "@mindshare/shared";

export const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: fine, we just won't remember */
    }
  },
  del(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const tokenKey = (code: string) => `ms:token:${code}`;

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error";
}

export interface RoomConn {
  status: "connecting" | "open" | "reconnecting" | "dead";
  fatal: string | null;
  state: PublicState | null;
  priv: PrivateState | null;
  q: number[];
  role: "player" | "audience" | null;
  seatId: string | null;
  offset: number; // serverNow - clientNow
  lastStateAt: number;
  tell: { text: string; mood: string } | null;
  reveal: RevealData | null;
  toasts: Toast[];
  send: (msg: ClientMessage) => void;
  dismiss: (id: number) => void;
  lastError: { code: string; message: string; at: number } | null;
}

let toastSeq = 0;

export function wsUrl(code: string) {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws/${code}`;
}

/** One WebSocket per room, reconnecting with the stored seat token. */
export function useRoom(code: string, nickname: string | null, opts: { board?: boolean; audience?: boolean } = {}): RoomConn {
  const [status, setStatus] = useState<RoomConn["status"]>("connecting");
  const [fatal, setFatal] = useState<string | null>(null);
  const [state, setState] = useState<PublicState | null>(null);
  const [priv, setPriv] = useState<PrivateState | null>(null);
  const [q, setQ] = useState<number[]>([]);
  const [role, setRole] = useState<RoomConn["role"]>(null);
  const [seatId, setSeatId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [lastStateAt, setLastStateAt] = useState(0);
  const [tell, setTell] = useState<RoomConn["tell"]>(null);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastError, setLastError] = useState<RoomConn["lastError"]>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const attempts = useRef(0);
  const stopped = useRef(false);

  const toast = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = ++toastSeq;
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 3500 : 4500);
  }, []);

  useEffect(() => {
    if (!nickname) return;
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl(code));
      } catch {
        setFatal("Couldn't open a connection to the game server.");
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => {
        attempts.current = 0;
        setStatus("open");
        const seatToken = opts.board ? undefined : store.get(tokenKey(code)) ?? undefined;
        ws.send(
          JSON.stringify({
            type: "join",
            code,
            nickname: opts.board ? "__board__" : nickname,
            seatToken,
            asAudience: opts.board || opts.audience || undefined,
          }),
        );
      };
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (msg.type) {
          case "welcome":
            setRole(msg.role);
            setSeatId(msg.seatId);
            if (msg.seatToken && !opts.board) store.set(tokenKey(code), msg.seatToken);
            break;
          case "state":
            (window as unknown as { __msPhase?: string }).__msPhase = msg.state.phase;
            setOffset(msg.state.now - Date.now());
            setLastStateAt(Date.now());
            setState(msg.state);
            if (msg.state.q.length) setQ(msg.state.q);
            if (!msg.state.tell) setTell(null);
            else setTell(msg.state.tell);
            setReveal(msg.state.reveal);
            break;
          case "private":
            setPriv(msg.private);
            setRole(msg.private.role);
            if (msg.private.seatId) setSeatId(msg.private.seatId);
            break;
          case "prices":
            setQ(msg.q);
            break;
          case "tell":
            setTell({ text: msg.text, mood: msg.mood });
            break;
          case "reveal":
            setReveal(msg.reveal);
            break;
          case "toast":
            toast(msg.message);
            break;
          case "pong":
            break;
          case "error":
            setLastError({ code: msg.code, message: msg.message, at: Date.now() });
            if (msg.code === "closed" || msg.code === "no_room" || msg.code === "kicked") {
              setFatal(msg.message);
              stopped.current = true;
              if (msg.code !== "kicked") store.del(tokenKey(code));
            } else toast(msg.message, "error");
            break;
        }
      };
      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        if (stopped.current) {
          setStatus("dead");
          return;
        }
        setStatus("reconnecting");
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempts.current++);
        timer = setTimeout(connect, delay);
      };
    };

    connect();
    const onVisible = () => {
      if (document.visibilityState === "visible" && !wsRef.current && !stopped.current) {
        clearTimeout(timer);
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped.current = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [code, nickname, opts.board, opts.audience, toast]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  return { status, fatal, state, priv, q, role, seatId, offset, lastStateAt, tell, reveal, toasts, send, dismiss, lastError };
}

/** Milliseconds left in the current phase, ticking locally against server time. */
export function useCountdown(endsAt: number | null, offset: number, hz = 10): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000 / hz);
    return () => clearInterval(id);
  }, [endsAt, hz]);
  if (endsAt == null) return null;
  return endsAt - (now + offset);
}

export async function createRoom(): Promise<string> {
  const res = await fetch("/api/rooms", { method: "POST" });
  if (!res.ok) throw new Error("Couldn't create a room right now. Try again in a moment.");
  const data = (await res.json()) as { code: string };
  return data.code;
}

export async function roomInfo(code: string): Promise<{ exists: boolean; closed: boolean; phase: string | null }> {
  const res = await fetch(`/api/rooms/${code}`);
  if (!res.ok) return { exists: false, closed: false, phase: null };
  return res.json();
}
