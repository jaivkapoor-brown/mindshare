import {
  KW_HATE,
  KW_IDENTITY_BOT,
  KW_LOVE,
  KW_QUIRK,
  KW_SHORT_BONUS,
  KW_SHORT_LEN,
} from "./config";
import { fnv1a } from "./rng";
import type { Persona, Ticker, Trait, TraitKind } from "./types";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reCache = new Map<string, RegExp>();

/**
 * Does `text` contain keyword `kw`?
 * - Keywords with no letters ("?", "!!", ",", "1") match as substrings.
 * - ALL-CAPS keywords ("NO", "STOP") match case-sensitively on word boundaries.
 * - Everything else matches case-insensitively on word boundaries, allowing an "s", "es", "ing" or "ed" suffix.
 */
export function keywordHit(text: string, kw: string): boolean {
  if (!/[a-z]/i.test(kw)) return text.includes(kw);
  const caps = kw.length > 1 && kw === kw.toUpperCase() && /[A-Z]{2}/.test(kw) && kw !== "AI" && kw !== "VHS" && kw !== "CD" && kw !== "KPI" && kw !== "SUV" && kw !== "ID";
  const key = (caps ? "C:" : "I:") + kw;
  let re = reCache.get(key);
  if (!re) {
    re = new RegExp(`(^|[^A-Za-z0-9])${escapeRe(kw)}(s|es|ing|ed)?(?=$|[^A-Za-z0-9])`, caps ? "" : "i");
    reCache.set(key, re);
  }
  return re.test(text);
}

export function countHits(text: string, keywords: readonly string[]): number {
  let n = 0;
  for (const kw of keywords) if (keywordHit(text, kw)) n++;
  return n;
}

export interface ScoreDetail {
  ticker: string;
  score: number;
}

/** The spec's fallback judge score: +2 loves, -2 hates, +1 quirk, +1 if short. */
export function keywordScore(persona: Pick<Persona, "loves" | "hates" | "quirk">, text: string): number {
  let s = 0;
  s += KW_LOVE * countHits(text, persona.loves.keywords);
  s += KW_HATE * countHits(text, persona.hates.keywords);
  s += KW_QUIRK * countHits(text, persona.quirk.keywords);
  if (text.length < KW_SHORT_LEN) s += KW_SHORT_BONUS;
  return s;
}

/** Score using only the traits a player (or bot) knows. Used for bot beliefs. */
export function partialScore(known: { kind: TraitKind; trait: Trait }[], text: string): number {
  let s = 0;
  for (const { kind, trait } of known) {
    const hits = countHits(text, trait.keywords);
    if (kind === "loves") s += KW_LOVE * hits;
    else if (kind === "hates") s += KW_HATE * hits;
    else if (kind === "quirk") s += KW_QUIRK * hits;
    else s += KW_IDENTITY_BOT * hits;
  }
  return s;
}

export interface KeywordVerdict {
  winner: string;
  runnerUp: string | null;
  scores: ScoreDetail[];
}

/** Deterministic: same persona, answers and seed always give the same verdict. */
export function keywordJudge(
  persona: Pick<Persona, "loves" | "hates" | "quirk">,
  answers: readonly Ticker[],
  seed: string,
): KeywordVerdict {
  if (answers.length === 0) throw new Error("keywordJudge needs at least one answer");
  const scored = answers.map((a) => ({
    ticker: a.ticker,
    score: keywordScore(persona, a.text),
    len: a.text.length,
    tie: fnv1a(seed + ":" + a.ticker),
  }));
  const ranked = scored.slice().sort((x, y) => y.score - x.score || x.len - y.len || x.tie - y.tie);
  return {
    winner: ranked[0].ticker,
    runnerUp: ranked[1]?.ticker ?? null,
    scores: scored.map(({ ticker, score }) => ({ ticker, score })),
  };
}

export const FALLBACK_REASONS = [
  "The judge nods slowly.",
  "The judge taps the gavel once. That's the one.",
  "The judge says nothing, but points.",
  "The judge squints, then smiles.",
];
