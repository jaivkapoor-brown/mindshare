import { DurableObject } from "cloudflare:workers";

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
  OPENAI_API_KEY?: string;
}

export class Room extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    ws.send(typeof message === "string" ? `echo:${message}` : message);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/ws\/([A-Za-z]{4})$/);
    if (m) return env.ROOM.get(env.ROOM.idFromName(m[1].toUpperCase())).fetch(request);
    if (url.pathname === "/api/health") return Response.json({ ok: true });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
