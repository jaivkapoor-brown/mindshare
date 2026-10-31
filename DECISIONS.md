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
