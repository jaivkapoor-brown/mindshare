# AGENTS.md — Mindshare

Read `SPEC.md` first. It is the single source of truth. Never change a MUST in it. If you must deviate, record why in `DECISIONS.md` and continue.

## What this is

A browser party game for 3 to 10 phones. Players write an answer to a prompt, trade the answers on a live prediction market (LMSR), and get paid out by an AI judge with a hidden personality. Built for the Handshake x OpenAI "Create a Multiplayer Game" challenge. Deadline: November 2, 2026.

## Repo layout (target)

```
/client    Vite + React + TypeScript, phone-first. Routes: /, /r/CODE, /board/CODE
/server    Cloudflare Worker + Durable Objects (one DO per room). TypeScript.
/shared    Types, zod message schemas, LMSR math, keyword judge, config.ts (every constant)
/shared/traits.json      Judge trait deck (human-curated; extend in the same voice, never delete)
/shared/prompts.json     Round prompts (human-curated; extend in the same voice)
/prompts/*.md            LLM prompt templates (never inline prompts in code)
SPEC.md, DECISIONS.md, BUILD_RECEIPT.md, MORNING.md
```

The `/server` folder currently holds the Cloudflare `durable-objects-template` scaffold (a Counter DO in `src/index.mjs`). Replace it; keep `wrangler.toml` settings that already work (see below).

## Infrastructure that already works (do not break)

- Cloudflare account is logged in via `wrangler login`.
- Worker name: `server`. Public URL: **https://server.jai-v-kapoor.workers.dev**
- Durable Objects on the free plan require `new_sqlite_classes` in migrations (already set). Keep using SQLite-backed DOs. Add a new migration tag when you rename or add a DO class; never edit an applied migration.
- `OPENAI_API_KEY` is already uploaded as a Worker secret. Locally, read it from `server/.dev.vars` (gitignored). Never log it, never send it to the client.
- Static client: serve it from the same Worker using Workers Static Assets (`[assets] directory = "../client/dist"` in `wrangler.toml`) so there is ONE public URL. Only split to Cloudflare Pages if assets + DO cannot coexist; record the reason.

## Commands

| Command | Purpose |
| --- | --- |
| `npm install` (root, workspaces) | Install everything |
| `npm run dev` | Client dev server + `wrangler dev` for the Worker |
| `npm test` | Vitest unit + integration (LLM mocked) |
| `npm run e2e` | Playwright, 3 contexts at 360px |
| `npm run build` | Build client into `client/dist` |
| `npm run deploy` | Build client, then `cd server && npx wrangler deploy` |
| `npx wrangler tail` (in `server/`) | Live logs from production |
| `npx wrangler types` (in `server/`) | Regenerate binding types after editing wrangler.toml |

Deploy after every milestone and smoke-test the public URL with `curl -i` before moving on.

## Rules of engagement

1. Build milestones in SPEC.md order. Run the milestone's "done when" check and all tests before starting the next.
2. LLM calls: wire the deterministic fallback FIRST, test the game end to end on fallbacks, then add the real OpenAI call behind it. If the API errors twice in a row during development, keep the fallback and note it in DECISIONS.md.
3. Every constant from the spec lives in `shared/config.ts`. No magic numbers in logic.
4. Every edge case in the spec's "Edge cases" table gets a test.
5. Do not ask the human questions. Pick the simplest playable interpretation, record it in `DECISIONS.md` (dated, one line each), and continue.
6. Commit after each milestone with a message `M<n>: <what>`. Do not force-push.
7. Do not delete or rewrite entries in `traits.json` or `prompts.json`; append only, matching the existing voice.
8. Keep `MORNING.md` current after every milestone and backlog item (see OVERNIGHT_BRIEF.md). It must always describe the current state: what works, what is skipped, the public URL, how to run a solo game in 30 seconds, and the three decisions you were least sure about.

## Cloudflare notes

Your knowledge of Workers APIs may be stale. For Durable Object alarms, WebSocket hibernation, SQLite storage, and Static Assets, check https://developers.cloudflare.com/durable-objects/ and https://developers.cloudflare.com/workers/static-assets/ before writing code. Use `state.acceptWebSocket()` (hibernation API) and `state.storage.setAlarm()` for phase timers; never `setTimeout` for anything that must survive eviction.
