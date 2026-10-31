# BUILD_RECEIPT.md

How Mindshare was built with agentic coding. This becomes the submission description and the honest record of who decided what. The agent appends to sections 2 to 4 as it works; the human owns section 1 and finalizes before submission.

## 1. The original intent (human)

I wanted a multiplayer party game where the AI is structural, not decorative. Most AI party games use the model as a content generator; I wanted one where the model plays a role a human cannot play fairly: a neutral judge with a secret, consistent personality that players have to model from partial information. The prediction market is the mechanism that pools everyone's partial clues into a single price, which is the same reason real prediction markets exist. The commit-reveal hash is there because the moment players suspect the judge changed its mind after seeing the trades, the game is dead.

Design pillars, in order: legible in one screen; the reveal is the payoff; the AI is structural; fair and auditable; social over solitary; cheap to run.

## 2. What the AI got wrong (agent appends, human edits)

- The room-code collision test looped forever: a rigged random source produced "AAAA", which the generator rejects, so it spun. Fixed the test's random source.
- Scores came out as "-0" when a tiny loss was halved in the practice round; fixed with `|| 0`.
- The first slow-verdict test waited on a promise that never resolves; the test harness, not the game, was stuck. Restructured the test.
- The first deploy after M2 shipped a stale client bundle because the client wasn't rebuilt after a UI fix; caught by eyeballing, redeployed. `npm run deploy` always rebuilds.
- Keyword matching first missed "fetching" for the keyword "fetch"; added -ing/-ed suffixes.
- The first verdict design (gpt-5.5 for 4.2 s, then a sequential retry) failed about half the time under 6 parallel calls. Replaced it with a parallel hedge.
- The first decoy prompt let the decoy writer, who sees the whole judge, write answers that won 83% of rounds; humans with one clue each couldn't compete. Bots also ignored their clues. Both fixed; see docs/llm-eval.md.
- The first player copy used "bet" and "cash", which the contest rules forbid (no gambling language). Replaced them.

## 3. Human decisions that changed the game (human, after playtests)

- 

## 4. What was built with agents versus by hand

- Spec, trait deck seed, prompt seed, architecture choices: human.
- Scaffolding, LMSR implementation and tests, server state machine, client screens, deploy pipeline: agent, directed by SPEC.md.
- Trait deck and prompt list expansion (to 44/53/53/43 traits and 157 prompts) plus the 216-answer decoy bank: a sub-agent, appending in the human's voice. Human review recommended.
- Model choice: the agent benchmarked 8 OpenAI models on a verdict-shaped call and chose gpt-5.5 (judgment) hedged by gpt-5.4-mini (speed).
- Decoy tuning: an opt-in real-API eval (`server/test/real-llm.test.ts`) showed decoys winning 83% of simulated rounds; prompt changes brought it to 50%.


## 5. Submission description (draft, 2 paragraphs)

Mindshare is a party game for 3 to 10 phones. Everyone writes an answer to a prompt, then trades those answers on a live prediction market. Prices are "% chance the judge picks this". The twist: the judge is an AI with a hidden personality, and each player only knows one clue about it. The market is the only place the clues combine, so watching prices move tells you what other people know. Halfway through, the judge drops a hint in character. Then it rules, the market settles, and the reveal shows who wrote what, who held what, which answers were AI decoys, and what the judge was really like.

Under the hood: an authoritative Cloudflare Durable Object per room, a logarithmic market scoring rule so there is always a price and the house's loss is bounded, and a commit-reveal hash that locks the judge in before anyone trades. The judge never sees the market. Every AI call has a deterministic fallback, so the game runs even if the API does not. Join with a room code, no login, no install; play alone with bots or with a room full of friends.
