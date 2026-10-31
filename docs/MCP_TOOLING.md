# Claude + MCP Boundary (Section D)

Status: PROPOSED (2026-10-28). Spec target: MCP **2026-07-28** (final; stateless core, Tasks and MCP Apps extensions — source: https://blog.modelcontextprotocol.io/tags/protocol/, read 2026-10-28). claude.ai custom connectors support remote MCP over Streamable HTTP with OAuth (https://support.claude.com/en/articles/11503834); which spec revision and whether MCP Apps render in claude.ai today is `NEEDS VERIFICATION` before we depend on it.

## D.1 What Claude does itself vs what becomes a tool

| Claude performs itself (reasoning, no side effects) | Deterministic tools / services (MCP or internal) |
|---|---|
| Look at photos/video keyframes and describe content, quality issues, people count (never identities), brand visibility | Decode, hash, EXIF, blur/exposure metrics, keyframe extraction |
| Infer what event a group of media represents, propose name/summary (marked *inferred*) | Time/GPS clustering, near-duplicate detection |
| Extract structured features from historical posts (pillar, hook type, CTA type, tone) | Fetch posts and metrics from platforms; store raw + normalized |
| Interpret normalized analytics, write explanations with evidence counts | Compute baselines, z-scores, shrinkage, confidence tiers (SQL/TS) |
| Plan the week given scored opportunities and constraints; justify | Score opportunities, check collisions, enforce caps |
| Write 2–4 strategically different options, captions, hooks, alt text | Render images/carousels/video from a recipe; validate specs |
| Critique its own drafts against identity voice and grounding facts | Grounding matcher, duplicate-caption check, length/format validators |
| Summarize trend evidence and judge fit/risk | Web search (Claude server tool, allow-listed domains), RSS fetch, expiry |
| Recommend a time window and explain | Time-window model computation |
| **Never**: approve, publish, hold tokens, decide permissions | Approval capture (human UI), Publish Gate, token vault, RBAC |

Business rules (state machine, approval, idempotency, rate limits, permissions) live in `packages/domain` and `packages/publishing`, never in prompts.

## D.2 Two places MCP is used

1. **User control plane** — remote MCP server `apps/mcp` added to claude.ai as a custom connector. The user talks to Claude; Claude calls our tools with **the user's own OAuth identity** (our IdP), so every call is authorized as that person.
2. **Internal agents** (optional) — backend jobs call the Claude API directly with **function tools** defined in code (not MCP) for planning/option generation. Reason: internal jobs need tight schemas, strict tool use, and no network hop; MCP adds nothing there. (The same tool implementations are shared.)

## D.3 Server and scope split

| MCP server / scope | Tools | Risk | Who gets it |
|---|---|---|---|
| `smi.read` | account discovery, historical posts, analytics, weekly media, asset metadata, brand knowledge, trend context, plan, queue, audit (admin) | Read-only; may expose unpublished media metadata | All roles (Viewer and above), filtered by identity permissions |
| `smi.studio` | create/update event facts, mark media, persist plan edits, edit/regenerate options, trigger render, create previews | Writes internal drafts only; never external | Content team, Admin, CEO (CEO identity only) |
| `smi.publish` | `request_approval`, `schedule_approved`, `cancel_scheduled`, `refresh_analytics` | Can cause external effects **only on already-approved content** | Admin, Approvers |

There is **no** `approve` tool and **no** "publish arbitrary content" tool. `schedule_approved` can only schedule a candidate whose approval row matches the current content hash; the human approval happens in the web UI (or via a signed one-time link Claude hands the user). Even if a prompt injection convinces Claude to call `schedule_approved`, the worst case is scheduling something a human already approved byte-for-byte.

OAuth scopes are separate (`smi.read`, `smi.studio`, `smi.publish`). The authorization server issues tokens with the intersection of requested scopes and the user's role. Tokens are audience-bound to the MCP resource (RFC 8707 resource indicators per MCP auth spec), short-lived (15 min access, rotating refresh).

## D.4 Tool catalogue

Conventions for every tool: JSON Schema 2020-12 input, `additionalProperties:false`; IDs are our internal UUIDs (never platform IDs); every call logs an `audit_event` (reads logged at `info` level in a separate cheaper table `access_log`); results never include tokens, signed URLs valid > 5 min, or raw personal data beyond what the UI shows.

### Read tools (`smi.read`)

| Tool | Input concept | Notes |
|---|---|---|
| `list_identities` | — | Identities the caller may see, with capability flags (API vs manual lane) |
| `get_account_capabilities` | `identity_id` | Granted vs required scopes, token expiry, blocked features |
| `list_historical_posts` | `identity_id, platform?, since?, until?, format?, pillar?, limit≤100, cursor?` | Normalized fields + feature record id |
| `get_post_performance` | `post_id` or `published_post_id` | Raw metrics (latest snapshot), normalized scores, baseline used, confidence tier |
| `get_insights_summary` | `identity_id, platform, goal, window_days` | Precomputed "what works" table with effect sizes, n, confidence |
| `list_batches` / `get_batch` | `batch_id?` | Upload status, counts, events |
| `list_batch_media` | `batch_id, filter (hero/weak/duplicate/do_not_use), cursor` | Thumbnails via 5-min signed URLs |
| `get_asset` | `media_asset_id` | Metadata, quality metrics, Claude description, consent flags |
| `get_brand_knowledge` | `identity_id` | Voice profile, pillars, disallowed topics, approved facts library |
| `get_trends` | `identity_id?, platform?, min_score?` | Only non-expired signals with evidence links |
| `get_plan` / `get_options` | `week_start` / `planned_post_id` | Options with reasoning, confidence, risks |
| `get_queue` | `range` | Per-target states |
| `get_audit_events` | `filters` | Admin only |

### Studio tools (`smi.studio`) — internal writes

| Tool | Input concept | Authorization | Approval needed | Idempotency | Audit fields | Failure modes |
|---|---|---|---|---|---|---|
| `update_event_facts` | `event_id, facts[] {key, value, source: user}` , `expected_version` | `edit` on batch's workspace | No | Optimistic concurrency via `expected_version` | actor, tool, event_id, diff, client=mcp, trace_id | Version conflict → returns current version |
| `mark_media` | `media_asset_id[], flags {do_not_use?, hero?, consent_status?}` | `edit` | No | Set-semantics (repeat = no-op) | actor, ids, before/after | Unknown id; permission denied |
| `merge_events` / `split_event` | ids, `expected_version` | `edit` | No | Version | diff | Conflict |
| `save_plan_edits` | `plan_id, ops[] (move/add/remove slot)`, `expected_version` | `plan` | No | Version | ops | Collision warnings returned, not blocking |
| `edit_option` | `option_id, caption?, media_order?, recipe_params?`, `expected_version` | `edit` on identity | No (but voids any approval) | Version | diff, voided_approval_id | Grounding check fails → returns ungrounded spans |
| `regenerate_option` | `option_id or planned_post_id, reason (free text), keep?: [...]` | `edit` | No | `client_request_id` (UUID) dedupes | reason stored as learning signal | LLM budget exhausted; schema failure retried |
| `render_preview` | `option_id, targets[]` | `edit` | No | Keyed by recipe hash (pure function → cached) | recipe hash | Render error with recipe step |

### Publish tools (`smi.publish`) — external effect possible

| Tool | Input concept | Authorization | Approval requirement | Idempotency | Audit fields | Failure modes |
|---|---|---|---|---|---|---|
| `request_approval` | `option_id, targets[] {identity_id, platform}, proposed_time_window` | `edit` | Creates an approval request; returns **one-time signed URL** to the web approval page + list of approvers notified | `client_request_id` | requester, option, content_hash, targets | Gates not passed → returns failing gates |
| `schedule_approved` | `approval_id, target_id, run_at (ISO, tz)` | `schedule` on target identity | **Must** reference an approval whose `content_hash` == current rendered content hash and whose targets include this target; CEO identity may require CEO approver | `idempotency_key` derived server-side (never supplied by model) | actor, approval_id, target, run_at, content_hash, token_expiry_check | Approval missing/voided; token will be expired at run_at; rate budget; workspace paused |
| `cancel_scheduled` | `scheduled_job_id, reason` | `schedule` | No | Repeat = no-op | actor, reason, prior state | Already `PUBLISH_SENT` → refused, suggests delete flow in UI |
| `refresh_analytics` | `published_post_id or identity_id` | `read` + `refresh` | No | Coalesced: one refresh per post per 15 min | actor | Platform rate limit → queued |

Publish-now is **not** an MCP tool in MVP; it is a button on the approval page (the human is already there).

## D.5 Defences specific to MCP

- **Tool output is data.** Our tools return captions, comments, trend text, filenames, EXIF — all attacker-controllable. Every text field that originated outside our team is wrapped as `{"untrusted_text": "..."}` and tool descriptions say so; Claude system prompts for internal jobs state that tool content is never instructions.
- **No secrets in context.** Tokens stay in the vault; tools use server-side bindings.
- **Server-side authorization on every ID.** A model-supplied `identity_id` is checked against the caller's grants; IDs are UUIDv7 (non-guessable enough, but authorization is the control).
- **Rate limits per user per tool** (e.g. 30 studio writes/min, 10 publish-tool calls/hour).
- **Human-visible confirmations.** For `smi.publish` tools we mark `destructiveHint`/`openWorldHint` annotations so clients prompt the user; we don't rely on this.
- **Kill switch** disables `smi.publish` scope issuance instantly.
