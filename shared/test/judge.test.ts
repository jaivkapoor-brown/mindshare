import { describe, expect, it } from "vitest";
import { TRAITS, keywordHit, keywordJudge, keywordScore } from "../src";

const persona = {
  loves: TRAITS.loves.find((t) => t.id === "dogs")!,
  hates: TRAITS.hates.find((t) => t.id === "technology")!,
  quirk: TRAITS.quirks.find((t) => t.id === "puns")!,
};

describe("keyword matching", () => {
  it("uses word boundaries", () => {
    expect(keywordHit("my next idea", "ex")).toBe(false);
    expect(keywordHit("my ex called", "ex")).toBe(true);
    expect(keywordHit("Dogs everywhere", "dog")).toBe(true);
    expect(keywordHit("dogma", "dog")).toBe(false);
  });
  it("matches punctuation keywords as substrings", () => {
    expect(keywordHit("why though?", "?")).toBe(true);
    expect(keywordHit("1994 vibes", "9")).toBe(true);
  });
  it("matches ALL CAPS keywords case-sensitively", () => {
    expect(keywordHit("NO WAY", "NO")).toBe(true);
    expect(keywordHit("no way", "NO")).toBe(false);
  });
});

describe("keyword judge", () => {
  const answers = [
    { ticker: "A", text: "a robot that downloads apps all day long for no reason" },
    { ticker: "B", text: "a puppy fetching a tennis ball" },
    { ticker: "C", text: "a slightly damp sandwich" },
  ];
  it("is deterministic and returns a valid ticker", () => {
    const a = keywordJudge(persona, answers, "seed1");
    const b = keywordJudge(persona, answers, "seed1");
    expect(a).toEqual(b);
    expect(["A", "B", "C"]).toContain(a.winner);
    expect(a.winner).toBe("B");
  });
  it("scores per the spec formula", () => {
    // puppy + fetch = 2 loves hits (+4), under 40 chars (+1)
    expect(keywordScore(persona, "a puppy fetching a tennis ball")).toBe(5);
    // robot, app, download = 3 hates (-6), long (0)
    expect(keywordScore(persona, "a robot that downloads apps all day long for no reason")).toBe(-6);
  });
});
