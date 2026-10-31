# MORNING.md

**Public URL:** https://server.jai-v-kapoor.workers.dev

## Play a solo game in 30 seconds (phone)
1. Open the URL, type a nickname, tap **Play solo with bots**.
2. Tap **Start game** (pick **3** rounds first for a short game). Read your clue → **Got it** → write an answer → **Submit**.
3. On the market tap **+** on answers you think the judge will pick (hold for 5). At 0:30 the judge drops a hint. After the reveal, tap **Scores → Next round** to skip waiting.

## Status
| Item | Status | Note |
| --- | --- | --- |
| M0 scaffold | done | monorepo, strict TS, Vitest, Playwright, CI workflow |
| M1 rooms + sync | done | codes, seat tokens, reconnect, host migration, DO alarms, hibernation |
| M2 core round | done | LMSR market, keyword judge, reveal + replay chart, scoreboard |
| M3 LLM, bots, tutorial | done | real OpenAI calls with fallbacks, clue-aware bots, tutorial round, commit-reveal ✓ |
| M4 social | done | audience wallet + crowd pick, TV board with QR, Insider mode + vote, sounds, share card |
| M5 polish | done | copy pass (no gambling words), error states, keyboard e2e, cover, description. **Left for you: submit the Handshake form.** |
| BL1 playthrough + screenshots | done | `screenshots/` (taken from production); lobby, market and board compacted |
| BL2 latency | done | verdict p95 ≈ 5.0 s (`docs/llm-eval.md`) |
| BL3 judge quality | done | 97% agreement with keyword top-2 (target 70%) |
| BL4 decoy quality | done | length +4% (target ±20%); decoys win 50% vs a fair 33% (see below) |
| BL5 custom judge | done | lobby → "Custom judge (optional)" |
| BL6 cover image | done | `submission/cover.png` |
| BL7 description | done | `submission/description.md` |
| BL8 accessibility | done | keyboard e2e, focus rings, aria labels on ±, reduced motion |
| BL9 performance | done | 94 KB gzipped JS; first paint 0.4–0.6 s, FCP ≤ 1 s on throttled 4G (`node e2e/perf.mjs`) |
| BL10 README | done | |

Tests: `npm test` = 80 unit/integration (LLM mocked); `npm run e2e` = 7 Playwright (3 phones in sync, solo full game + board + share card, keyboard-only, unsupported browsers). Opt-in real-API eval: `REAL_LLM=1 npx vitest run server/test/real-llm.test.ts`.

## Deployed vs local
Everything committed is deployed (last deploy after the "Backlog 1" commit). Real LLM calls are on in production. Nothing is local-only.

## Least-sure decisions (with the alternative)
1. **Liquidity b = 25/40** (kept from spec). Measured: a 20-credit buy moves a price ~44 points with 5 answers; the spec's own 10–15 target needs b≈100. Relatedly, one tap buys 1 share for ~0.2 credits, so casual tapping moves round scores only a few points and royalties (+30) dominate. Tune b and `TRADE_SIZE_*` together in `shared/config.ts`.
2. **Decoys win ~50% of rounds** (fair share 33%) in simulated solo play, down from 83%. I kept the spec's 50% bait rate because it's yours to set; lowering `DECOY_BAIT_RATE`, or hiding the judge's "loves" from the decoy writer, would bring it down.
3. **Verdict model: gpt-5.5 (reasoning low) hedged by gpt-5.4-mini in parallel**, ~4–5 s. Alternative: gpt-5.4-mini alone (~1 s, judges a little worse) — change `MODEL_BEST` in config.

Also worth a look: moderation only blocks strong categories so edgy jokes survive; the trait/prompt deck expansion was written by an agent in your voice and wants your review (open question in SPEC).

## Known bugs / rough edges
- In a solo game with Insider mode on, the "who was the Insider" vote is mostly bots voting at random (works, but not meaningful alone).
- The 60 s market can't be skipped (spec), so a solo round is ~1.5–2 minutes minimum.
- Cloudflare returned a transient "internal authentication error" on one deploy; a retry fixed it.

## Single most valuable next task
A real 5-phone playtest (SPEC playtest checklist), then set b, the bait rate and the tell timing from what you see.
