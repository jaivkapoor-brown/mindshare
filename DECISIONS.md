# DECISIONS.md

Every judgment call the agent makes that the spec did not settle. One line each, dated, newest at the bottom. The human reviews these in the morning.

Format: `- YYYY-MM-DD HH:MM  M<n>  <decision>  (alternative: <what was not picked>)`

## Human decisions (pre-build)

- 2026-10-31 00:00  M0  Server is Cloudflare Workers + Durable Objects (SQLite-backed, free plan). Worker name `server`, URL https://server.jai-v-kapoor.workers.dev. (alternative: Colyseus on Fly.io)
- 2026-10-31 00:00  M0  Client is served from the same Worker via Static Assets so there is one public URL. (alternative: separate Cloudflare Pages site)
- 2026-10-31 00:00  M0  Overnight scope is the full build: Milestones 0 to 5 plus the backlog in OVERNIGHT_BRIEF.md. Priority if cutting: 2 > 3 > 5 > 4. Only the Handshake form submission is left for the human.

## Agent decisions

- 2026-10-31 00:30  M0  Plain Durable Object class with the hibernation API instead of PartyServer; fewer moving parts and the docs map 1:1. (alternative: PartyServer)
- 2026-10-31 00:30  M0  Game logic is a pure synchronous `RoomEngine` (injected clock, send, LLM, alarm); the DO is a thin adapter. Integration tests run the engine in plain Vitest with simulated clients. (alternative: @cloudflare/vitest-pool-workers)
- 2026-10-31 00:30  M0  "Lint" is a strict `tsc --noEmit` over all three packages; no ESLint to keep the toolchain small. (alternative: ESLint + typescript-eslint)
- 2026-10-31 00:30  M0  SHA-256 is implemented in plain JS in /shared so state transitions never await and the client can verify the commit without a secure context. Tested against node:crypto. (alternative: crypto.subtle)
- 2026-10-31 00:30  M0  Keywords match on word boundaries, case-insensitive, allowing s/es/ing/ed suffixes; punctuation/digit keywords match as substrings; ALL-CAPS keywords match case-sensitively. Each distinct keyword counts once. (alternative: substring matching, which made "next" hit "ex")
- 2026-10-31 00:35  M0  Kept B_LIQUIDITY 25/40 from the spec table even though a 20-credit buy measures ~44 points with 5 answers (b≈100 would give the spec's 10–15). b is a human-reserved open question; flagged in MORNING.md. (alternative: b=100)
- 2026-10-31 00:35  M0  Deleted the template's Counter DO via migration v2 (`deleted_classes`); it held only a demo counter. (alternative: rename Counter to Room)
- 2026-10-31 01:10  M1  M1 and M2 landed in one commit: the engine was written as one state machine, so splitting it would have meant writing throwaway dummy-timer code. (alternative: separate dummy-timer M1 build)
- 2026-10-31 01:10  M2  Prices broadcast on every trade, capped at 10 Hz, instead of a fixed 10 Hz interval; history is sampled on trades (max 4/s). No 100 ms alarm loop. (alternative: 10 Hz alarm)
- 2026-10-31 01:10  M2  MAX_SHARES_PER_OUTCOME (60) is per player per answer. (alternative: a global cap on q)
- 2026-10-31 01:10  M2  "(no answer)" and moderated answers are not tradable tickers; they appear in the reveal only. Decoys top up to at least 3 tickers. (alternative: list "(no answer)" as a ticker)
- 2026-10-31 01:10  M2  Added a SCOREBOARD phase (20 s, host can skip) after REVEAL as the spec's Scoreboard screen. The host can also skip CLUE, WRITE, VERDICT and REVEAL; MARKET cannot be skipped. (alternative: scoreboard inside REVEAL)
- 2026-10-31 01:10  M2  CLUE ends early once every connected player taps "Got it" (bots auto-ack), like WRITE. (alternative: always 8 s)
- 2026-10-31 01:10  M2  The commit hash is computed when SETUP ends (after the judge's name/voice arrive or 3 s pass) and shown from CLUE onwards, so it covers the full persona including name and voice. (alternative: hash only the traits at SETUP start)
- 2026-10-31 01:10  M2  Kept the spec's fallback formula exactly (identity keywords do not score); bots add +1 per identity keyword to their beliefs so an identity clue is still useful. (alternative: score identity keywords in the judge)
- 2026-10-31 01:10  M2  "Bots never win ties against humans" is applied to standings tie-breaks only; the judge never sees authorship, so it can't prefer humans. (alternative: keyword-judge tiebreak favoring humans, which leaks authorship)
- 2026-10-31 01:10  M2  The board view joins as a read-only viewer (not counted as audience, no wallet). (alternative: board as an audience seat)
- 2026-10-31 01:10  M2  The idle-closed room keeps a tiny "closed" tombstone after its storage is wiped so the code says "This room has closed"; creating a room may reuse a closed code. (alternative: no tombstone, "no room" message)
- 2026-10-31 01:40  M3  Models: MODEL_BEST = gpt-5.5 (reasoning low, ~3.5 s, best judgment in a 8-model bench) for the verdict; MODEL_FAST = gpt-5.4-mini (reasoning none, ~1 s) for everything else and for the verdict retry. Temperature is sent only to non-reasoning calls. (alternative: gpt-4.1 at temperature 0.3, ~1 s but picked the "most terrible" answer instead of the persona's favorite)
- 2026-10-31 01:40  M3  Verdict "retry of one" fits inside 6 s: first attempt gets 4.2 s on MODEL_BEST, the retry gets what's left on MODEL_FAST, and the engine's 6 s alarm applies the keyword judge regardless. (alternative: 6 s + 6 s)
- 2026-10-31 01:40  M3  The decoy, tell and bot-answer calls start at CLUE (not MARKET start) so their latency hides behind CLUE + WRITE. (alternative: tell starts at MARKET)
- 2026-10-31 01:40  M3  Moderation: local word list always runs first; the OpenAI moderation endpoint only removes answers with strong hate/sexual/self-harm/threat scores, so edgy-but-fine party jokes survive. WRITE waits up to 2 s past its timer for pending moderation. (alternative: block anything the endpoint flags)
- 2026-10-31 01:40  M3  Injection regression uses the real verdict prompt with a mock model that parses the delimited answers out of the prompt and judges by content; it checks the "untrusted" rule is present and that delimiters can't be broken (`<`/`>` are stripped from all player text). (alternative: real API in CI)
- 2026-10-31 01:40  M3  A tell that contains the trait text verbatim is discarded for the template. (alternative: accept it)
- 2026-10-31 01:40  M3  Custom judge (spec M5 MAY) built early since it was one LLM call: it maps onto deck loves/hates/quirk ids, writes its own identity line, and judges every round of that game. (alternative: wait for M5)
- 2026-10-31 02:05  M4  Audience join paths: late joiners and players past 10 become audience automatically; anyone can also "Just watch" from the home screen (/r/CODE?watch=1). The TV board itself is read-only with no wallet. (alternative: board URL grants a wallet)
- 2026-10-31 02:05  M4  Insider vote: bots vote randomly so solo games aren't blocked; the host can close the vote. A seat is "caught" only with a strict majority; a caught Insider loses only positive winnings from their Insider rounds. (alternative: plurality)
- 2026-10-31 02:05  M4  Sounds are synthesized with WebAudio (no files) and off by default everywhere until toggled; preference is remembered. (alternative: on by default on laptops)
