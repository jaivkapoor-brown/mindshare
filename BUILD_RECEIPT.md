# BUILD_RECEIPT.md

How Mindshare was built with agentic coding. This becomes the submission description and the honest record of who decided what. The agent appends to sections 2 to 4 as it works; the human owns section 1 and finalizes before submission.

## 1. The original intent (human)

I wanted a multiplayer party game where the AI is structural, not decorative. Most AI party games use the model as a content generator; I wanted one where the model plays a role a human cannot play fairly: a neutral judge with a secret, consistent personality that players have to model from partial information. The prediction market is the mechanism that pools everyone's partial clues into a single price, which is the same reason real prediction markets exist. The commit-reveal hash is there because the moment players suspect the judge changed its mind after seeing the trades, the game is dead.

Design pillars, in order: legible in one screen; the reveal is the payoff; the AI is structural; fair and auditable; social over solitary; cheap to run.

## 2. What the AI got wrong (agent appends, human edits)

- 

## 3. Human decisions that changed the game (human, after playtests)

- 

## 4. What was built with agents versus by hand

- Spec, trait deck seed, prompt seed, architecture choices: human.
- Scaffolding, LMSR implementation and tests, server state machine, client screens, deploy pipeline: agent, directed by SPEC.md.
- 

## 5. Submission description (draft, 2 paragraphs)

Mindshare is a party game for 3 to 10 phones. Everyone writes an answer to a prompt, then trades those answers on a live prediction market. Prices are "% chance the judge picks this". The twist: the judge is an AI with a hidden personality, and each player only knows one clue about it. The market is the only place the clues combine, so watching prices move tells you what other people know. Halfway through, the judge drops a hint in character. Then it rules, the market settles, and the reveal shows who wrote what, who held what, which answers were AI decoys, and what the judge was really like.

Under the hood: an authoritative Cloudflare Durable Object per room, a logarithmic market scoring rule so there is always a price and the house's loss is bounded, and a commit-reveal hash that locks the judge in before anyone trades. The judge never sees the market. Every AI call has a deterministic fallback, so the game runs even if the API does not. Join with a room code, no login, no install; play alone with bots or with a room full of friends.
