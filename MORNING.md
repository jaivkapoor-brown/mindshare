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
| M4 social | in progress | audience wallet + crowd pick, board/TV view, Insider, sounds, share card are built and tested; polish pending |
| M5 polish | pending | |
| Backlog 1–10 | pending | |

## Deployed vs local
Everything committed is deployed. Real LLM calls are on in production.

## Least-sure decisions
1. **Liquidity b = 25/40** (kept from spec). Measured: a 20-credit buy moves a price ~44 points with 5 answers; the spec's own target (10–15) needs b≈100. Alternative: b=100.
2. **Verdict on gpt-5.5 (reasoning low, ~3.5 s)** with a gpt-5.4-mini retry. Alternative: gpt-4.1 (~1 s) which tended to pick the "most terrible" answer literally.
3. **Moderation only blocks strong categories** so edgy jokes survive. Alternative: block anything flagged.

## Known bugs / next task
- Next: M4 polish pass, then M5.
