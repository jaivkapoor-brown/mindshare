import { z } from "zod";
import { ANSWER_MAX, NICK_MAX, NICK_MIN, ROUND_OPTIONS } from "./config";
import type { Clue, Persona, PrivateState, PublicState, RevealData } from "./types";

const ticker = z.string().regex(/^[A-Z]$/);
const code = z.string().regex(/^[A-Za-z]{4}$/);

export const ClientMessage = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("join"),
    code,
    nickname: z.string().trim().min(NICK_MIN).max(NICK_MAX),
    seatToken: z.string().regex(/^[a-f0-9]{32}$/).optional(),
    asAudience: z.boolean().optional(),
  }),
  z.object({ type: z.literal("host.start") }),
  z.object({ type: z.literal("host.skip") }),
  z.object({ type: z.literal("host.extend") }),
  z.object({ type: z.literal("host.kick"), seatId: z.string().min(1).max(32) }),
  z.object({ type: z.literal("host.addBots") }),
  z.object({ type: z.literal("host.removeBots") }),
  z.object({
    type: z.literal("host.config"),
    rounds: z.number().int().refine((n) => (ROUND_OPTIONS as readonly number[]).includes(n)),
    insider: z.boolean(),
    tutorial: z.boolean().optional(),
    customJudge: z.string().max(200).optional(),
  }),
  z.object({ type: z.literal("clue.ack") }),
  z.object({ type: z.literal("write.submit"), text: z.string().max(ANSWER_MAX * 2) }),
  z.object({
    type: z.literal("market.trade"),
    ticker,
    side: z.enum(["buy", "sell"]),
    qty: z.number().int().min(1).max(10),
    expectedCost: z.number().finite(),
  }),
  z.object({ type: z.literal("audience.vote"), ticker }),
  z.object({ type: z.literal("insider.vote"), seatId: z.string().min(1).max(32) }),
  z.object({ type: z.literal("ping"), t: z.number() }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

export type ServerMessage =
  | { type: "welcome"; seatId: string | null; seatToken: string | null; role: "player" | "audience" }
  | { type: "state"; state: PublicState }
  | { type: "private"; private: PrivateState }
  | { type: "prices"; q: number[]; prices: number[]; t: number }
  | { type: "tell"; text: string; mood: string }
  | { type: "reveal"; reveal: RevealData }
  | { type: "toast"; message: string }
  | { type: "pong"; t: number; now: number }
  | { type: "error"; code: string; message: string };

export function parseClientMessage(raw: unknown): ClientMessage | null {
  let data = raw;
  if (typeof raw === "string") {
    if (raw.length > 4000) return null;
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const r = ClientMessage.safeParse(data);
  return r.success ? r.data : null;
}

export type { Clue, Persona };
