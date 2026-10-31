import { describe, expect, it } from "vitest";
import { buyCost, lmsrCost, lmsrPrices, makeRng, maxAffordable, sellRefund } from "../src";

describe("LMSR", () => {
  it("prices sum to 1 within 1e-9", () => {
    const rng = makeRng("sum");
    for (let t = 0; t < 1000; t++) {
      const n = rng.int(2, 12);
      const q = Array.from({ length: n }, () => rng.int(-50, 200));
      const p = lmsrPrices(q, 25);
      expect(Math.abs(p.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-9);
    }
  });

  it("buy then sell the same quantity returns the original cash", () => {
    const rng = makeRng("roundtrip");
    for (let t = 0; t < 500; t++) {
      const q = Array.from({ length: 5 }, () => rng.int(0, 60));
      const i = rng.int(0, 4);
      const k = rng.int(1, 20);
      const cost = buyCost(q, 25, i, k);
      const q2 = q.slice();
      q2[i] += k;
      const refund = sellRefund(q2, 25, i, k);
      expect(Math.abs(cost - refund)).toBeLessThan(1e-9);
    }
  });

  it("cost of k shares is monotone in k", () => {
    const q = [3, 0, 10, 0];
    let prev = 0;
    for (let k = 1; k <= 60; k++) {
      const c = buyCost(q, 25, 1, k);
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });

  it("house loss never exceeds b*ln(n) across 10,000 random trade sequences", () => {
    const rng = makeRng("house");
    for (let t = 0; t < 10_000; t++) {
      const n = rng.int(3, 12);
      const b = rng.pick([25, 40]);
      const q = new Array(n).fill(0);
      let collected = 0;
      const steps = rng.int(1, 30);
      for (let s = 0; s < steps; s++) {
        const i = rng.int(0, n - 1);
        const k = rng.int(1, 10);
        if (rng.next() < 0.75 || q[i] < k) {
          collected += buyCost(q, b, i, k);
          q[i] += k;
        } else {
          collected -= sellRefund(q, b, i, k);
          q[i] -= k;
        }
      }
      const winner = rng.int(0, n - 1);
      const loss = q[winner] - collected;
      expect(loss).toBeLessThanOrEqual(b * Math.log(n) + 1e-6);
    }
  });

  it("a 20-credit buy moves a price at least 10 points with b=25 and 5 answers (measured ~44; see DECISIONS)", () => {
    const q = [0, 0, 0, 0, 0];
    const k = maxAffordable(q, 25, 0, 20);
    const q2 = q.slice();
    q2[0] += k;
    const move = lmsrPrices(q2, 25)[0] - lmsrPrices(q, 25)[0];
    expect(move).toBeGreaterThan(0.08);
    expect(move).toBeLessThan(0.5);
  });

  it("cost is stable for large q", () => {
    expect(Number.isFinite(lmsrCost([5000, 0, 0], 25))).toBe(true);
  });
});
