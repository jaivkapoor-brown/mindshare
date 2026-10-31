# MORNING.md

**Public URL:** https://server.jai-v-kapoor.workers.dev

## Play a solo game in 30 seconds (phone)
1. Open the URL, type a nickname, tap **Play solo with bots**.
2. Tap **Start game**. Read your clue, tap **Got it**, write an answer, **Submit**.
3. Tap **+** on answers you think the judge will pick (hold for 5 shares). Watch the reveal. The host (you) can tap **Scores → Next round** to skip waiting.

## Status
| Item | Status | Note |
| --- | --- | --- |
| M0 scaffold | done | monorepo, strict TS, Vitest, Playwright, CI |
| M1 rooms + sync | done | codes, seat tokens, reconnect, host migration, DO alarms |
| M2 core round | done | LMSR market, keyword judge, reveal + replay chart, scoreboard |
| M3 LLM, bots, tutorial | done | real OpenAI calls with fallbacks, solo bots, tutorial round, commit-reveal check |
| M4 social | done | audience wallet + crowd pick, TV board with QR, Insider mode + vote, sounds, share card |
| M5 polish | done | copy pass, error states, keyboard e2e, cover image, description; Handshake form submission is left for you |
| BL1 playthrough + screenshots | partial | screenshots/ has every screen; lobby, market, tutorial and board fixes done |
| BL2 latency | done | verdict p95 ≈ 5.0 s (docs/llm-eval.md) |
| BL3 judge quality | done | 97% agreement with keyword top-2 |
| BL4 decoy quality | done | length +4%; decoys win 50% vs a fair 33% (see below) |
| BL5 custom judge | done | built during M3 |
| BL6 cover image | done | submission/cover.png |
| BL7 description | done | submission/description.md |
| BL8 accessibility | done | keyboard e2e, focus rings, aria labels, reduced motion |
| BL9 performance | pending | |
| BL10 README | done | |

## Deployed vs local
Everything committed is deployed. Real LLM calls are on in production.

## Least-sure decisions
1. **Liquidity b = 25/40** (kept from spec). Measured: a 20-credit buy moves a price ~44 points with 5 answers; the spec's own target (10–15) needs b≈100. Alternative: b=100.
2. **Verdict on gpt-5.5 (reasoning low, ~3.5 s)** with a gpt-5.4-mini retry. Alternative: gpt-4.1 (~1 s) which tended to pick the "most terrible" answer literally.
3. **Decoys win about 50% of rounds** (fair share 33%) in simulated solo play, down from 83%. I kept the spec's 50% bait rate because it's reserved for you; lowering it (or hiding the judge's "loves" from the decoy writer) would bring it down further.
4. **Moderation only blocks strong categories** so edgy jokes survive. Alternative: block anything flagged.
5. **A tap buys 1 share for about 0.2 credits** at b=25, so casual tapping moves round scores by only a few points; royalties (+30) dominate. Tune b and TRADE_SIZE together.

## Known bugs / next task
- Next: backlog (playthrough polish, latency, judge/decoy quality checks).
- Submission files: `submission/cover.png`, `submission/description.md`.
