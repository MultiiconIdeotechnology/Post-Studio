# Architecture Decision Records

Format: context → decision → consequences. Status of all: **Proposed (2026-10-28)** until the architecture is accepted.

| ADR | Decision | Why | Revisit when |
|---|---|---|---|
| ADR-001 | TypeScript monorepo (pnpm workspaces) for web, API, worker, MCP | One language, shared Zod schemas between API, MCP and prompts' structured outputs; mature MCP and Anthropic SDKs | A heavy ML need appears that only Python serves (then add a Python worker) |
| ADR-002 | PostgreSQL is the system of record **and** the job queue (pg-boss) | Jobs commit atomically with state (no dual-write); one backup; small data volume | Sustained > ~50 jobs/s or multi-day sagas → Temporal |
| ADR-003 | No Redis/Valkey in MVP | No measured need | Caching/rate-limit coordination needs across many instances |
| ADR-004 | S3 API for storage; managed by default, SeaweedFS for self-host; MinIO rejected | MinIO CE archived 2026-04-25, no community binaries | — |
| ADR-005 | Claude is the only AI service; Claude API with structured outputs; Batch API for backfill; prompt caching for identity packs; default model `claude-opus-5-5` (cheaper models only after evals show equal quality and the user agrees) | Claude-first principle; no extra vendors | Evals show a cheaper model suffices for bulk triage |
| ADR-006 | Business rules in `packages/domain`, never in prompts | Auditable, testable | — |
| ADR-007 | Our scheduler publishes all platforms; Facebook native scheduling unused | IG and LinkedIn lack native scheduling; one mechanism for cancel/edit/idempotency | FB-only reliability issue |
| ADR-008 | Approval is a human action in the web UI bound to a content hash + targets; no MCP approve tool | Prompt-injection and insider safety | Phase 6 policy-controlled autonomy |
| ADR-009 | MCP split into read / studio / publish-request scopes; publish tools only act on approved content | Least privilege | — |
| ADR-010 | Separate LinkedIn developer app containing only Community Management API, serving company Page and CEO member | LinkedIn requires CM be the sole product on the app | LinkedIn policy change |
| ADR-011 | CEO Facebook personal profile handled as a manual lane | No API publishing to profiles since 2018 | CEO creates a Page |
| ADR-012 | Versioned metric catalogue; never equate deprecated and replacement metrics | Meta deprecations 2025/2026 explicitly not 1:1 | — |
| ADR-013 | Effects reported with shrinkage + confidence tiers; findings with n_eff < 5 never shown | Avoid overfitting small samples | Enough data for richer models |
| ADR-014 | Templates via Satori + resvg; Remotion rejected (source-available, company licence) | Deterministic, OSS | Motion templates become priority and a licence is bought |
| ADR-015 | Tokens envelope-encrypted with KMS or OpenBao; Vault rejected (BUSL-1.1) | OSS preference + security | — |
| ADR-016 | Generative editing (Level C) deferred until the core loop runs 2 real weeks | Focus on closed loop | After M8 |
| ADR-017 | Pin Meta Graph v25.0 and LinkedIn 202610+; scheduled upgrades | Version sunsets | Each sunset notice |

## Amendments (2026-10-31, start of implementation)

| ADR | Decision | Why | Revisit when |
|---|---|---|---|
| ADR-001a | Start as **one** TypeScript service (API + web + scheduler in one container), not a pnpm monorepo | One `docker compose up` is the requirement; a single team; split later along the ADR-001 lines when worker load or a second UI appears | Image jobs block the API, or a second deployable is needed |
| ADR-004a | Media on a local Docker volume served at `/media/`, not S3, for the first slice | Self-hosted single server; Instagram only needs a public HTTPS URL | Second server, or backups need object storage (then S3-compatible per ADR-004) |
| ADR-005a | Claude is reached from the **server** with an API key (`ANTHROPIC_API_KEY`); the browser never holds a key. Development happens in Claude Code / this project on the Pro plan | Keys stay on the server; usage billing is per API; Pro covers the building | — |
| ADR-016a | Image models are called **directly** from the server through one `ImageProvider` interface (fal.ai for FLUX/Ideogram/Kling, Gemini, OpenAI). MCP is not used inside the server; an MCP server *exposing* the studio to Claude is a later slice | Direct API calls are simpler and faster; MCP adds a hop with no benefit server-side. Midjourney has no official API and is excluded | A provider ships an official MCP-only surface |
| ADR-018 | Text and the wordmark are composited by us (`images/compose.ts`, sharp + SVG), never generated inside the image | Image models still misspell text and distort logos | Models render brand-exact text reliably |
| ADR-019 | Publishing is gated three times: human approval bound to a content hash, `IG_PUBLISH_ENABLED=true`, and the Meta app in dev mode against a test account until verified | Mistakes on a company account are public | After two clean weeks on the real account |
