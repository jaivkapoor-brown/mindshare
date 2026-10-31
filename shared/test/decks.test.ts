import { describe, expect, it } from "vitest";
import { DECOY_BANK, PROMPTS, TRAITS } from "../src";

describe("content decks", () => {
  it("meet the spec minimums", () => {
    expect(TRAITS.identities.length).toBeGreaterThanOrEqual(40);
    expect(TRAITS.loves.length).toBeGreaterThanOrEqual(50);
    expect(TRAITS.hates.length).toBeGreaterThanOrEqual(50);
    expect(TRAITS.quirks.length).toBeGreaterThanOrEqual(40);
    expect(PROMPTS.length).toBeGreaterThanOrEqual(150);
    expect(Object.values(DECOY_BANK).flat().length).toBeGreaterThanOrEqual(200);
  });
  it("have unique ids and non-empty keywords", () => {
    for (const deck of [TRAITS.identities, TRAITS.loves, TRAITS.hates, TRAITS.quirks]) {
      const ids = deck.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const t of deck) {
        expect(t.keywords.length).toBeGreaterThan(0);
        expect(t.clue_text.length).toBeGreaterThan(0);
      }
    }
    expect(new Set(PROMPTS.map((p) => p.id)).size).toBe(PROMPTS.length);
  });
  it("every prompt category has decoys", () => {
    for (const p of PROMPTS) expect(DECOY_BANK[p.category]?.length ?? 0).toBeGreaterThan(5);
  });
});
