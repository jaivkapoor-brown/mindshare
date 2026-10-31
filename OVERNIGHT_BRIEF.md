# Overnight brief — paste this into the agent

Copy everything below the line into Codex / Claude Code / ChatGPT Work, started in the repo root (`~/Desktop/mindshare`).

---

Read `AGENTS.md`, then `SPEC.md` in full, before writing any code.

Your job tonight: build the complete Mindshare game. Work through Milestones 0, 1, 2, 3, 4 and 5 in that order, then keep going down the backlog below until you are stopped. The goal is that the human wakes up to a finished, deployed, polished game that a stranger can play alone on a phone at the public URL. Do not stop early. Do not wait for input. The human is asleep and will not answer; make the simplest playable choice, log it in `DECISIONS.md`, and continue.

Hard rules:
- Each milestone must pass its "done when" check and all tests before you start the next. Deploy to the public URL after every milestone and verify with `curl -i https://server.jai-v-kapoor.workers.dev`. The deployed build must always be playable; never leave production broken while you work on the next thing.
- Priority order if anything must be cut: Milestone 2 (full game, keyword judge) > 3 (LLM, bots, tutorial) > 5 (polish, copy, error states) > 4 (audience, Insider, board, share card). Never cut from 2 or 3.
- For every LLM call: deterministic fallback first, real call second. Mock the LLM in all tests. If the OpenAI API errors twice in a row, keep the fallback, log it, and move on. Re-try wiring the real call at the end of the night.
- One person on a phone must be able to play a full game alone (solo mode with bots) from the end of Milestone 3 onward. A contest judge will evaluate alone.
- The API key lives only in Worker secrets and `server/.dev.vars`. Never log it or ship it to the client.
- Serve the client from the same Worker (Static Assets) so there is exactly one public URL.
- Append to `shared/traits.json` and `shared/prompts.json` to reach the spec minimums (40 identities, 50 loves, 50 hates, 40 quirks, 150 prompts). Match the existing voice: concrete, specific, funny, no vague moods. Do not edit or remove existing entries.
- Commit after each milestone (`M0: ...`, `M1: ...`) and after each backlog item.
- Keep `DECISIONS.md` and `BUILD_RECEIPT.md` section 2 ("what the AI got wrong") current as you go, one line per entry.

Stop conditions (these keep you moving, not stop you):
- If a milestone has not passed its done check after roughly 2 hours of effort, write what is blocking it in `DECISIONS.md`, reduce its scope to the smallest version that passes, and continue.
- If the deploy breaks and you cannot fix it in 30 minutes, `npx wrangler rollback` to the last working deploy and keep developing locally; retry the deploy after the next milestone.
- If you run out of milestones and backlog, do a full solo playthrough with Playwright at 360px, fix every rough edge you find, and repeat.

After Milestone 5, work through this backlog in order:
1. Full solo playthrough on the deployed URL via Playwright at 360x640, screenshots of every screen saved to `/screenshots`. Fix anything ugly, cramped, or confusing.
2. Latency: measure time from MARKET end to REVEAL with the real API over 10 rounds; if p95 is over 6 s, tighten prompts or switch the verdict to the fast model.
3. Judge quality: run 30 verdicts with the real API against fixed personas and answers; check that the verdict matches the fallback judge's top-2 at least 70% of the time. If not, tighten the verdict prompt.
4. Decoy quality: generate 30 decoys and check they match human answer length (median within 20%). Tighten if not.
5. Custom judge mode (spec Milestone 5 MAY): host types a description, LLM maps it to the persona schema.
6. Cover image 1200x630 PNG for the submission, generated from the client's own styles (an HTML page rendered with Playwright is fine), saved to `/submission/cover.png`.
7. `submission/description.md`: the 2-paragraph description from `BUILD_RECEIPT.md`, finalized, plus the project URL and a 3-step "how to play alone" for the judge.
8. Accessibility: keyboard-only playthrough on laptop; focus rings; aria labels on the +/− buttons; reduced-motion respected.
9. Performance: client bundle under 300 KB gzipped; first paint under 1.5 s on a throttled 4G Playwright profile.
10. README.md: what the game is, a GIF or screenshots, how to run locally, how to deploy, link to SPEC.md.

Whatever state you are in when stopped, `MORNING.md` must exist and be current. Update it after every milestone and every backlog item, with:
1. The public URL and a 30-second recipe to play a solo game on a phone.
2. A table of milestones and backlog items: done / partial / skipped, one line each.
3. What is deployed versus only local.
4. The three decisions you were least sure about, with the alternative you did not pick.
5. Known bugs and the single most valuable next task.

Begin with Milestone 0 now.
