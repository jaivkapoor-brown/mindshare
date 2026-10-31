import { DurableObject } from "cloudflare:workers";
import { ROOM_CODE_RETRIES, isValidCode, randomCode, randomHex } from "@mindshare/shared";
import type { ServerMessage } from "@mindshare/shared";
import { RoomEngine, newRoomState } from "./engine";
import type { ConnInfo, EngineDeps, RoomStateData } from "./engine";
import { makeLlm } from "./openai";

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
  OPENAI_API_KEY?: string;
  LLM_MODE?: string;
}

interface Attachment {
  connId: string;
  info: ConnInfo;
}

export class Room extends DurableObject<Env> {
  private engine: RoomEngine | null = null;
  private closed = false;
  private sockets = new Map<string, WebSocket>();
  private alarmAt: number | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.closed = (await ctx.storage.get<boolean>("closed")) ?? false;
      const state = await ctx.storage.get<RoomStateData>("state");
      this.alarmAt = await ctx.storage.getAlarm();
      if (state && !this.closed) this.load(state);
    });
  }

  private deps(): EngineDeps {
    return {
      now: () => Date.now(),
      send: (connId, msg: ServerMessage) => {
        const ws = this.sockets.get(connId);
        if (!ws) return;
        try {
          ws.send(JSON.stringify(msg));
        } catch {
          /* socket already gone */
        }
      },
      close: (connId, reason) => {
        const ws = this.sockets.get(connId);
        this.sockets.delete(connId);
        try {
          ws?.close(4000, reason.slice(0, 100));
        } catch {
          /* ignore */
        }
      },
      llm: makeLlm(this.env),
      persist: (state) => {
        void this.ctx.storage.put("state", state);
      },
      setAlarm: (at) => {
        if (at === this.alarmAt) return;
        this.alarmAt = at;
        if (at == null) void this.ctx.storage.deleteAlarm();
        else void this.ctx.storage.setAlarm(at);
      },
      log: (entry) => console.log(JSON.stringify(entry)),
      expire: () => {
        this.closed = true;
        this.engine = null;
        void this.ctx.storage.deleteAll().then(() => this.ctx.storage.put("closed", true));
      },
      attach: (connId, info) => {
        const ws = this.sockets.get(connId);
        ws?.serializeAttachment({ connId, info } satisfies Attachment);
      },
    };
  }

  private load(state: RoomStateData) {
    this.engine = new RoomEngine(this.deps(), state);
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att) continue;
      this.sockets.set(att.connId, ws);
      this.engine.restore(att.connId, att.info);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const code = (url.searchParams.get("code") ?? "").toUpperCase();
    if (url.pathname === "/init") {
      if (this.engine && !this.engine.s.closed) return new Response("taken", { status: 409 });
      await this.ctx.storage.delete("closed");
      this.closed = false;
      const state = newRoomState(code, Date.now());
      await this.ctx.storage.put("state", state);
      this.load(state);
      this.engine!.alarm(); // arms the idle timer
      return Response.json({ code });
    }
    if (url.pathname === "/info") {
      return Response.json({ exists: !!this.engine, closed: this.closed, phase: this.engine?.s.phase ?? null });
    }
    if (request.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    if (!this.engine) {
      const message = this.closed ? "This room has closed." : "No room with that code. Check the letters and try again.";
      server.send(JSON.stringify({ type: "error", code: this.closed ? "closed" : "no_room", message } satisfies ServerMessage));
      server.close(4004, "no room");
      return new Response(null, { status: 101, webSocket: client });
    }
    const connId = randomHex(8);
    const info: ConnInfo = { kind: null, id: null };
    server.serializeAttachment({ connId, info } satisfies Attachment);
    this.sockets.set(connId, server);
    this.engine.connect(connId, info);
    return new Response(null, { status: 101, webSocket: client });
  }

  private connIdOf(ws: WebSocket): string | null {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return null;
    if (!this.sockets.has(att.connId)) this.sockets.set(att.connId, ws);
    return att.connId;
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const connId = this.connIdOf(ws);
    if (!connId || !this.engine) return;
    if (typeof message !== "string") return;
    this.engine.message(connId, message);
  }

  async webSocketClose(ws: WebSocket) {
    const connId = this.connIdOf(ws);
    if (!connId) return;
    this.sockets.delete(connId);
    this.engine?.disconnect(connId);
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  async alarm() {
    this.alarmAt = null;
    this.engine?.alarm();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ws = url.pathname.match(/^\/ws\/([A-Za-z]{4})$/);
    if (ws) {
      const code = ws[1].toUpperCase();
      if (!isValidCode(code)) return new Response("bad code", { status: 400 });
      const stub = env.ROOM.get(env.ROOM.idFromName(code));
      return stub.fetch(new Request(`https://room/ws?code=${code}`, request));
    }
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      for (let i = 0; i < ROOM_CODE_RETRIES; i++) {
        const code = randomCode();
        const stub = env.ROOM.get(env.ROOM.idFromName(code));
        const res = await stub.fetch(`https://room/init?code=${code}`);
        if (res.ok) return Response.json({ code });
      }
      return Response.json({ error: "Couldn't find a free room code. Try again." }, { status: 503 });
    }
    const info = url.pathname.match(/^\/api\/rooms\/([A-Za-z]{4})$/);
    if (info) {
      const code = info[1].toUpperCase();
      if (!isValidCode(code)) return Response.json({ exists: false, closed: false, phase: null });
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(`https://room/info?code=${code}`);
    }
    if (url.pathname === "/api/health") return Response.json({ ok: true });
    if (url.pathname.startsWith("/api/")) return new Response("not found", { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
