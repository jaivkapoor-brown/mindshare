# DECISIONS.md

Every judgment call the agent makes that the spec did not settle. One line each, dated, newest at the bottom. The human reviews these in the morning.

Format: `- YYYY-MM-DD HH:MM  M<n>  <decision>  (alternative: <what was not picked>)`

## Human decisions (pre-build)

- 2026-10-31 00:00  M0  Server is Cloudflare Workers + Durable Objects (SQLite-backed, free plan). Worker name `server`, URL https://server.jai-v-kapoor.workers.dev. (alternative: Colyseus on Fly.io)
- 2026-10-31 00:00  M0  Client is served from the same Worker via Static Assets so there is one public URL. (alternative: separate Cloudflare Pages site)
- 2026-10-31 00:00  M0  Overnight scope is the full build: Milestones 0 to 5 plus the backlog in OVERNIGHT_BRIEF.md. Priority if cutting: 2 > 3 > 5 > 4. Only the Handshake form submission is left for the human.

## Agent decisions

