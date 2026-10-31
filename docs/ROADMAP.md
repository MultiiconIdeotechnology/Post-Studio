# MVP Scope and Roadmap (Sections P, Q + closing items 2 and 3)

Status: PROPOSED (2026-10-28). Durations assume **one to two engineers plus Claude doing most implementation** (`ASSUMPTION` until the "who builds" question is answered). Platform-review lead times are outside our control.

## P. MVP vs later

MVP must prove: **historical data → weekly media → intelligent drafts → approval → publish → analytics → learning**.

| Capability | MVP | Phase 2 | Phase 3 | Deferred |
|---|---|---|---|---|
| Identities | Company + CEO, separate personas | More identities (other execs) | | Multi-workspace agencies |
| Platforms | IG (professional), FB Page, LinkedIn org + CEO member (after CM vetting); manual lane for anything blocked | Stories publishing | | X/TikTok/YouTube |
| History | API backfill where allowed + CSV/export import (CEO LinkedIn) | Scheduled re-backfill of metric changes | | |
| Analytics | Snapshots at 1 h, 24 h, 72 h, 7 d, 28 d; raw + normalized; baselines; goal scores | Account-level dashboards, follower growth attribution | | Paid/ads analytics |
| Learning | Insight cards with confidence; user-choice feedback into prompts | Predicted-vs-actual calibration; formal experiments UI | Learned planner weights | Autonomous policy |
| Weekly media | Upload, dedupe, quality, event grouping, hero selection, facts | Video keyframe intelligence improvements | Transcription | |
| Planning | Greedy planner + Claude review | ILP planner, campaign calendar | | |
| Options | 2–4 options, captions, alt text, grounding check, critique | Per-option A/B experiments | | |
| Media | Level A deterministic + 3–5 Level B templates (recap carousel, quote card, single-photo frame, cover) | More templates; video trims/reels assembly | Trend-aware template generator | Level C generative |
| Scheduling | Window recommendation with confidence + cold-start exploration | Audience-timezone mixing | | |
| Approval & publishing | Hash-bound approval, publish now/scheduled, idempotency, reconcile, per-target status, kill switch | Four-eyes policy options, bulk approve per event | | Policy-controlled auto-publish (Phase 6 of context) |
| Trends | Weekly allow-listed web research + trend inbox | IG hashtag/Business Discovery (after review) | | Paid listening tools |
| Control plane | MCP read + studio + publish-request; web companion | MCP Apps previews in Claude (if supported) | | |
| Comments | Read counts only | Comment summaries, reply drafting (human-sent) | | Auto-replies |

Explicit rule: **no image-generation work before the closed loop has run end-to-end on real accounts for 2 consecutive weeks.**

## Q. Implementation roadmap

| Milestone | Deliverables | Dependencies | Exit criteria | Risks |
|---|---|---|---|---|
| **M0 Access & accounts (start day 1, runs in parallel)** | Meta Business portfolio verified; Meta app (dev + prod) created; IG accounts confirmed professional; CEO FB decision (Page vs manual); LinkedIn dedicated CM-only app created, Page super-admin verifies app, Development-tier request submitted; test Page/accounts created; privacy policy URL published | Company legal details, admin access to all accounts | Dev-tier LinkedIn approved; Meta app can call Graph API for our test + real assets with Standard Access | LinkedIn rejection (must re-apply with new app); Business Verification delays; CEO declines account changes |
| **M1 Walking skeleton (wk 1–2)** | Monorepo, CI, Postgres + migrations, S3, OIDC login, RBAC skeleton, audit writer with hash chain, pg-boss, OTel logging, deploy to staging | Hosting decision (default: single VM or small container service) | Login → create identity → audit visible; CI green; staging deployed | Infra choice delay → default to docker-compose on one VM |
| **M2 Connect + history (wk 2–4)** | OAuth connect flows (Meta FB Login for Business, IG Login, LinkedIn CM), token vault, capability snapshot, historical post + metric ingestion (API), CSV import for CEO LinkedIn, metric catalogue with deprecations | M0 access | All real accounts connected (or marked manual); ≥ 12 months history ingested where available; raw + normalized stored | LinkedIn dev-tier 500 calls/day slows backfill → paced backfill over days |
| **M3 Publish vertical slice (wk 3–5) — pulled early** | Manual draft → render (Level A) → hash-bound approval → publish now / scheduled → per-target status → reconcile → 1 h/24 h snapshots; kill switch | M2 tokens | Publish to test accounts on all 3 platforms ×10 with zero duplicates under fault injection; **LinkedIn Standard-tier screencast recorded and submitted** | Meta media-URL fetch issues; LinkedIn video processing delays |
| **M4 Historical intelligence (wk 5–7)** | Feature extraction (Batch API), baselines, goal scores, insight cards, voice analysis per identity | M2 data | Insight cards reviewed by marketing lead: ≥ 80% judged "accurate and useful"; no claims with n<5 shown | Too little history → cold start everywhere (acceptable, labelled) |
| **M5 Weekly media intelligence (wk 6–8)** | Upload inbox, dedupe, quality, event grouping, hero/supporting selection, facts entry, corrections | M1 storage | On a real past week's batch: event grouping needs ≤ 3 manual corrections per 100 assets; hero choice accepted ≥ 70% | EXIF missing from messaging-app photos |
| **M6 Plan + options + time (wk 8–10)** | Planner, 2–4 options with grounding + critique, templates (3–5), time-window recommendations, studio + comparison UI | M4, M5 | Marketing lead picks an option without rewriting for ≥ 60% of slots; zero ungrounded factual claims in eval set | CEO voice not convincing → more exemplars / CEO feedback loop |
| **M7 MCP control plane (wk 9–11)** | Remote MCP server (read/studio/publish-request), OAuth, claude.ai connector setup guide | M6 | A full week can be run from Claude except the approval click | claude.ai spec support mismatch |
| **M8 Closed loop live (wk 11–13)** | Real weekly cycle on production accounts, 7 d/28 d snapshots, predicted vs actual, user-choice learning, dashboards/alerts | All | 2 consecutive real weeks; 0 duplicate/wrong-account posts; upload-to-calendar < 1 working day | Team adoption |
| Phase 2+ | Experiments UI, trend integrations needing review, more templates, video assembly, comment summaries | MVP live | — | — |

Recurring: monthly platform changelog review; API version upgrade before each sunset (LinkedIn 202511 sunsets 2026-11-16 — we start on 202610 or later); quarterly licence re-check.

## Closing item 2 — Top 10 risks (priority order)

1. **LinkedIn Community Management vetting** is discretionary, must be on a CM-only app, and Standard tier requires a working-app screencast; rejection forces a new app. Blocks company + CEO LinkedIn automation. *Mitigation*: submit Dev tier on day 1, build the publish slice early to record the screencast, manual lane meanwhile.
2. **CEO accounts lack API support**: Facebook personal profile is blocked; Instagram personal account is blocked; CEO LinkedIn history is not readable via API. *Mitigation*: decide early (Page / Creator conversion / manual lane); import exports.
3. **Duplicate or wrong-account publishing** damaging trust in week one. *Mitigation*: hash-bound approvals, idempotency, reconcile, fault-injection tests, kill switch, test accounts first.
4. **Meta access level / Business Verification** needed if our setup doesn't count as "own/managed" assets. *Mitigation*: verify with live Standard Access in M0; start Business Verification in parallel.
5. **Thin historical data** → weak learning, tempting overfitting. *Mitigation*: shrinkage, confidence tiers, cold-start exploration, explicit "insufficient evidence".
6. **Hallucinated facts in captions** (names, numbers, quotes). *Mitigation*: facts-only generation, grounding checker blocks review, red-team eval set.
7. **Metric deprecations break analytics continuity** (Meta removed reach/impression metrics in 2025 and June 2026). *Mitigation*: versioned metric catalogue, raw snapshots, no cross-definition comparisons.
8. **Token expiry / revocation** silently stops scheduled posts (LinkedIn refresh tokens hard-expire at 365 days). *Mitigation*: expiry monitoring, schedule-time validation, BLOCKED_AUTH state with alerts.
9. **Prompt injection through uploaded media or web content** steering drafts. *Mitigation*: no model-held publish power, typed outputs, isolated trend processing, human review of final render.
10. **Scope creep into generative/trend features** delaying the core loop. *Mitigation*: the P table's rule; Level C deferred.

## Closing item 3 — First 15 implementation tasks (exact order)

1. Start platform access work (M0): create the LinkedIn developer app with only Community Management API, get Page super-admin verification, submit the Development-tier request; create Meta dev/prod apps under the company Business portfolio and start Business Verification.
2. Confirm account types: company IG (Business/Creator), CEO IG, CEO Facebook (profile vs Page), LinkedIn Page admins; record in OPEN_QUESTIONS.md.
3. Create test assets: test Facebook Page + test IG professional account + LinkedIn test page/profile, wired to dev apps.
4. Create the repository (needs your GitHub repo) with the R layout, pnpm workspaces, TypeScript strict, Vitest, lint, CI.
5. Docker-compose for local: Postgres 17, SeaweedFS (or LocalStack-free S3 stand-in), app processes; staging deploy script.
6. `packages/db`: first migration with workspace, app_user, role_assignment, social_identity, persona_profile, social_account, oauth_connection, audit_event (hash chain) + insert-only role.
7. `packages/auth`: OIDC login with company IdP, session, RBAC guard, permission matrix tests.
8. `packages/audit`: writer + chain verifier job + test.
9. Token vault: envelope encryption with KMS/OpenBao abstraction, redaction in logs, tests that no token reaches logs.
10. Meta connector v0: Facebook Login for Business flow, list Pages + linked IG accounts, store tokens, capability snapshot; contract tests from recorded fixtures.
11. LinkedIn connector v0: 3-legged OAuth (org admin + CEO member), org lookup + role check, capability snapshot (works on Dev tier).
12. `packages/publishing`: domain state machine for targets, idempotency key, Publish Gate, reconciler skeleton, fake-platform server with fault injection; tests for exactly-once behaviour.
13. Publish slice UI: create manual draft (caption + uploaded image), render IG/LI/FB variants (Level A), approval page with hash display, publish now to **test** accounts on all three platforms.
14. Scheduled publishing + per-target status + kill switch + 1 h/24 h metric snapshot jobs; record LinkedIn Standard-tier screencast and submit.
15. Historical ingestion: Meta posts + insights backfill (paced), LinkedIn org posts + share stats, CEO LinkedIn export importer, metric catalogue with deprecation rows.
