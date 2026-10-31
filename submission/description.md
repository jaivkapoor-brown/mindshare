# Mindshare

**Play it:** https://server.jai-v-kapoor.workers.dev

Mindshare is a party game for 3 to 10 phones. Everyone writes an answer to a prompt, then trades those answers on a live prediction market where prices read "% chance the judge picks this". The twist: the judge is an AI with a hidden personality, and each player knows only one clue about it (what it loves, what it hates, its quirk, or who it is). The market is the only place those clues combine, so watching prices move tells you what other people know. Halfway through, the judge drops a hint in character. Then it rules, the market settles, and the reveal shows who wrote what, who held what, which answers were AI decoys, and what the judge was really like.

Under the hood: one authoritative Cloudflare Durable Object per room pushes state to every phone over WebSockets; a logarithmic market scoring rule means there is always a price and trading is just + and −; and a commit-reveal hash locks the judge in before anyone trades, which every phone verifies at the reveal. The judge never sees the market, the players' names, or who wrote what. Every AI call (judge voice, decoys, the hint, the verdict, bot players, moderation) has a deterministic fallback, so the game keeps running even if the AI does not. Join with a 4-letter room code, no login, no install, play money only; play alone with bots or with a room full of friends.

## How to play alone (for the judge), about 5 minutes

1. Open https://server.jai-v-kapoor.workers.dev on a phone (or laptop), type a nickname, tap **Play solo with bots**, then **Start game**.
2. Each round: read your secret clue and tap **Got it**; write an answer the judge would love and tap **Submit**; on the market, tap **+** to buy answers you think will win (hold for 5 shares). At 0:30 the judge drops a hint.
3. Watch the reveal: the judge's pick and reason, the full persona with a green ✓ proving it was locked before trading, who wrote what (bots and AI decoys are tagged), and a price replay. As host you can tap **Scores → Next round** to skip waiting. Pick 3 rounds in the lobby for a shorter game.

Optional: open the **board** link from the lobby on a laptop or TV to see the shared screen, or open the room on a second device with "Just watch" to try the audience wallet and crowd vote.

## Submission checklist
- Title: Mindshare
- Cover image: `submission/cover.png` (1200x630)
- Description: the two paragraphs above
- Project URL: https://server.jai-v-kapoor.workers.dev
