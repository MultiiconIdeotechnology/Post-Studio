# Post Studio

Self-hosted studio that plans, generates, approves and publishes Instagram posts for Multiicon
(@multiicon.official), with Claude for thinking and image models for visuals. Other accounts
(Multiicon LinkedIn, Bonton Holidays, Market Maya) come later; keep the code account-agnostic
where it is cheap to do so.

## Read first

- `docs/PROJECT_CONTEXT.md` — who the company is, what the user wants, history of decisions
- `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` — target architecture and ADRs (amendments at the bottom)
- `docs/PLATFORM_CAPABILITIES.md` — verified Instagram / Meta / LinkedIn API limits; re-verify before touching a connector
- `docs/IMPLEMENTATION.md` — what exists in this repo today and how the pieces fit
- `docs/BRAND_SKILL.md` — brand facts and voice for each company (mirrored in `src/ai/brand.ts`; change both together)

## Non-negotiable rules

1. **A human approves every post.** Nothing publishes without `POST /api/posts/:id/approve` by a signed-in person, and the approval is bound to a hash of caption + images. Never add an auto-approve path or an MCP tool that approves.
2. **No invented facts.** Only facts in `src/ai/brand.ts` or typed in by the user may appear in a post. Unknowns are written as `[CONFIRM: ...]` and block approval.
3. **No passwords, ever.** Instagram is connected through Meta's official login/token flow. Never ask for or store an account password.
4. **Keys live on the server** (`.env`, GitHub secrets). The browser never receives an API key. Do not log keys or tokens.
5. **Trading content** (Market Maya) carries the risk line and a compliance note; never claim returns.
6. **Publishing is off by default** (`IG_PUBLISH_ENABLED=false`). It is switched on only after the test account has been verified.

## Stack and layout

TypeScript (ESM, Node 22), Fastify, PostgreSQL 17 (+ pg-boss queue in the `pgboss` schema), sharp, Anthropic SDK, fal.ai / Gemini / OpenAI SDKs. One container; `docker compose up` runs everything.

```
src/server.ts            Fastify app, static web, /api/status, startup (migrate → scheduler → listen)
src/config.ts            all settings from env (zod); a missing optional key switches a feature off
src/db/                  pg pool, SQL migrations (src/db/migrations/*.sql, applied in order on start)
src/ai/claude.ts         Claude service: text, JSON, images in; usage logged to llm_call
src/ai/brand.ts          brand registry: Multiicon, Market Maya, Bonton Holidays (facts, voice, pillars,
                         slide colours, wordmark); served to the page as /brands.js; systemFor(brand)
src/images/provider.ts   ImageProvider interface; fal.ts (FLUX, Ideogram, Kling), gemini.ts, openai.ts
src/images/compose.ts    deterministic text + wordmark overlay (sharp + SVG)
src/design/post-design.ts Claude designs whole slides (art + the slide's own words) as SVG: plan a look
                         per post, design slides in parallel, check words/placement, add wordmark
src/publish/instagram.ts Graph API container → publish flow
src/publish/scheduler.ts pg-boss queue "publish-post"; runPublish() moves post state
src/routes/              ai.ts, images.ts, plans.ts (plans, posts, approve, schedule)
web/index.html           the planner UI (ported from the Claude artifact); web/shim.js maps the old
                         window.claude.use() calls to this server; web/studio.js adds sign-in,
                         connection status, AI visuals and the real Post / Schedule flow
web/app.css, web/app.js  app shell: styles and design tokens, step rail and one-step-at-a-time
                         navigation (#plan #photos #polish #write #review); reads planner state only
web/vendor/              self-hosted fonts (Hanken Grotesk for UI, Inter for slides) and JSZip; no CDN
tests/                   vitest: unit tests and an HTTP test against a real Postgres
```

Post states: `draft → approved → scheduled → publishing → published`, plus `failed` (retried by pg-boss) and `cancelled`. Any content edit returns a post to `draft` and clears the approval.

Brands: each company is a section (`?brand=multiicon|marketmaya|bonton`). `plan.account` holds the brand's Instagram handle, so each brand has its own weeks; Multiicon keeps `multiicon.official` and its old browser key. Every Claude call, design call and plan save sends `brand`. App colours per brand live in `web/app.css` (`:root[data-brand=...]`), slide colours in `src/ai/brand.ts`.

## Working here

- `npm run dev` (needs `DATABASE_URL`), `npm test`, `npm run typecheck`. Tests need Postgres: `docker compose up -d db` then `DATABASE_URL=postgres://poststudio:poststudio@localhost:5432/poststudio npm test`.
- Default Claude model is `claude-opus-5-5`; do not downgrade for cost without the user's say-so. Use `output_config.effort`, never `budget_tokens`.
- Instagram accepts JPEG only, needs a public HTTPS URL at publish time, carousel max 10, no native scheduling (we schedule).
- Migrations are plain SQL; add a new numbered file, never edit an applied one.
- Keep prompts in the code that uses them; keep business rules out of prompts.
- Write plainly in UI copy and docs: short sentences, no hype, Indian English spelling.
- Commit messages: imperative, one line of what and why. Open a PR for anything beyond a typo.
