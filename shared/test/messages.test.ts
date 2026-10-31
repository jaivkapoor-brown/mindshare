import { describe, expect, it } from "vitest";
import { parseClientMessage } from "../src";

describe("message schemas", () => {
  it("accepts valid messages", () => {
    expect(parseClientMessage({ type: "join", code: "ABCD", nickname: "Jai" })).not.toBeNull();
    expect(parseClientMessage(JSON.stringify({ type: "market.trade", ticker: "A", side: "buy", qty: 1, expectedCost: 4 }))).not.toBeNull();
  });
  it("rejects malformed payloads", () => {
    const bad = [
      "not json",
      { type: "nope" },
      { type: "join", code: "AB", nickname: "Jai" },
      { type: "join", code: "ABCD", nickname: "J" },
      { type: "join", code: "ABCD", nickname: "x".repeat(40) },
      { type: "market.trade", ticker: "AA", side: "buy", qty: 1, expectedCost: 1 },
      { type: "market.trade", ticker: "A", side: "short", qty: 1, expectedCost: 1 },
      { type: "market.trade", ticker: "A", side: "buy", qty: 0, expectedCost: 1 },
      { type: "market.trade", ticker: "A", side: "buy", qty: 1.5, expectedCost: 1 },
      { type: "host.config", rounds: 4, insider: false },
      "x".repeat(5000),
    ];
    for (const b of bad) expect(parseClientMessage(b)).toBeNull();
  });
});
