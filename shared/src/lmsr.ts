// Logarithmic Market Scoring Rule. Shared by server (authoritative) and client (estimates).

/** C(q) = b * ln(sum exp(q_i / b)), computed with log-sum-exp for stability. */
export function lmsrCost(q: readonly number[], b: number): number {
  let max = -Infinity;
  for (const x of q) max = Math.max(max, x / b);
  let sum = 0;
  for (const x of q) sum += Math.exp(x / b - max);
  return b * (max + Math.log(sum));
}

export function lmsrPrices(q: readonly number[], b: number): number[] {
  let max = -Infinity;
  for (const x of q) max = Math.max(max, x / b);
  const e = q.map((x) => Math.exp(x / b - max));
  const s = e.reduce((a, c) => a + c, 0);
  return e.map((x) => x / s);
}

/** Credits to buy k shares of outcome i (negative k = sell, returns negative = refund). */
export function tradeCost(q: readonly number[], b: number, i: number, k: number): number {
  const next = q.slice();
  next[i] += k;
  return lmsrCost(next, b) - lmsrCost(q, b);
}

export function buyCost(q: readonly number[], b: number, i: number, k: number): number {
  return tradeCost(q, b, i, k);
}

export function sellRefund(q: readonly number[], b: number, i: number, k: number): number {
  return -tradeCost(q, b, i, -k);
}

/** Largest whole number of shares of outcome i affordable with `cash`. */
export function maxAffordable(q: readonly number[], b: number, i: number, cash: number, cap = Infinity): number {
  let k = 0;
  while (k < cap && buyCost(q, b, i, k + 1) <= cash + 1e-9) k++;
  return k;
}

export function toPercents(prices: readonly number[]): number[] {
  return prices.map((p) => Math.round(p * 100));
}

export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
