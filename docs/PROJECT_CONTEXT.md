# Project Context (governing)

Copied verbatim from the project file PROJECT_CONTEXT.txt on 2026-10-28. Edit the source of truth here once the repository exists.

---

# Social Media Intelligence & Publishing Automation — Claude Project Context

## 1. Project Identity

**Working project name:** Social Media Intelligence & Publishing Automation

**Primary objective:** Build a production-grade, Claude-first system that helps a company and its CEO plan, create, review, schedule, publish, measure, and continuously improve social-media content across Instagram, Facebook, and LinkedIn.

This project is not intended to be a generic “AI post generator.” It should become an intelligent social-media operating system that learns from the company’s and CEO’s own historical content, performance data, brand voice, audience response, weekly media uploads, current platform trends, and user feedback.

The long-term target experience is:

> The team uploads the week’s photos/videos and gives lightweight instructions. The system understands what happened, learns from past performance, proposes the strongest content plan, generates 2–4 polished options for each planned post, prepares platform-native captions and creative variations, recommends the best publishing time, and lets an authorized user approve/publish with minimal effort. After publishing, the system measures results and feeds the learnings back into future recommendations.

The system must serve **two distinct identities**:

1. **Company/Brand account(s)**
2. **CEO/Founder/Executive account(s)**

These identities must never be treated as interchangeable. Their voice, content pillars, acceptable topics, creative style, audience, posting cadence, calls to action, and performance models should be learned and stored separately.

---

## 2. Core Product Philosophy

### 2.1 Claude-first

Use Claude as the central intelligence layer wherever Claude is genuinely the best tool for:

- understanding images and documents;
- classifying events/content;
- selecting strong photos;
- finding patterns in historical posts;
- interpreting social analytics;
- planning content calendars;
- generating and refining captions;
- adapting tone by account and platform;
- generating creative directions;
- judging quality;
- recommending experiments;
- explaining why an option is likely to work;
- orchestrating approved tools through MCP or APIs.

Do **not** force an external AI service into the system when Claude can perform the reasoning itself.

However, never pretend Claude can perform a capability that requires an actual renderer, media processor, platform API, storage service, scheduler, or other execution layer. “Claude-first” means Claude is the intelligence/orchestration layer, not that all infrastructure must be an LLM.

### 2.2 Open-source and self-hostable by preference

For supporting infrastructure and deterministic media processing:

1. Prefer proven, actively maintained, self-hostable/open-source software.
2. Prefer direct official platform APIs over third-party social schedulers.
3. Prefer small composable services over a large vendor lock-in platform.
4. Evaluate maintenance activity, security history, license, adoption, API quality, observability, and operational burden before selecting a dependency.
5. Do not call a tool “open source” without verifying its current license.
6. If no suitable open-source option exists, explain the gap and present the safest practical fallback.

### 2.3 Human-in-the-loop by default

The initial production workflow must require an authorized human to approve the final creative/caption/account before publishing.

The user’s ideal action should eventually be close to:

**Review → choose option → approve/post**

The system may later support policy-controlled auto-publishing for low-risk content, but it must never silently enable this.

### 2.4 Learn from first-party performance

Generic social-media advice is secondary. The strongest signal should be the organization’s own data:

- historical posts;
- account-level analytics;
- post-level analytics;
- audience response;
- content type;
- visual style;
- caption structure;
- day/time;
- event/topic;
- CTA;
- platform;
- company vs CEO identity;
- user approvals/rejections/edits;
- performance after publishing.

### 2.5 Platform-native, not copy-paste

One source event may produce content for several platforms, but the final output should be adapted to each platform.

Do not blindly publish identical creative, caption, hashtags, formatting, aspect ratio, CTA, or schedule everywhere.

---

## 3. Important Platform Constraints

Claude must verify current official documentation before implementing any connector because platform APIs, permissions, review requirements, metrics, and versions change.

At project kickoff, assume these practical constraints until re-verified.

### Instagram

Automated publishing/insights should target eligible Instagram Professional accounts such as Business or Creator accounts, not ordinary consumer/personal accounts.

Account type, Meta app setup, permissions, token lifecycle, linked assets, media hosting requirements, and supported post types must be validated.

Never design around unofficial browser automation when an official API path exists.

### Facebook

Official publishing automation should target Facebook Pages/managed business assets.

Do not assume the official Graph API can publish to a CEO’s personal Facebook profile.

If the desired CEO presence is a personal profile, explicitly flag this as a product/API limitation and offer compliant alternatives such as a public Page or manual handoff workflow.

### LinkedIn

Treat organization Pages and member/personal profiles as separate integration paths.

Company Page management and analytics may require approved Community Management access and specific organization roles/scopes.

Member posting and member analytics have their own permissions and may require approval/consent.

Never assume access to profile analytics just because posting permission exists.

Pin supported API versions and monitor deprecations.

### General

No credential scraping.

No password-based browser bots for social networks.

No bypassing platform review/permission requirements.

No fake engagement, mass-comment spam, or engagement manipulation.

No scraping of private/user data in violation of platform terms.

If an API restriction blocks a desired feature, make the limitation visible in the product rather than hiding it.

---

## 4. Primary Users and Roles

Design for at least these roles.

### Admin / Marketing Lead

Connects/disconnects accounts, controls brand settings, configures weekly posting targets, manages user permissions, reviews analytics, approves publishing policies, approves or rejects content, and can publish immediately or schedule.

### Content/Marketing Team Member

Uploads weekly media, tags events or adds context, reviews generated options, edits captions, requests regeneration, proposes scheduling, and may publish only if granted permission.

### CEO / Executive

Can review CEO-account content, approve/reject/edit it, maintain a personal voice profile, and mark topics as “speak more/less about this.”

### Viewer / Analyst

Read-only access to analytics, calendar, and post history.

Use RBAC and preserve an audit trail for all publishing-related actions.

---

## 5. Account Separation Model

Each connected social identity must have an explicit profile containing:

- identity ID;
- identity type;
- platform;
- platform account/page ID;
- display name;
- account type;
- timezone;
- target audience;
- geography;
- languages;
- tone profile;
- brand/persona guidelines;
- content pillars;
- disallowed topics;
- legal/compliance notes;
- default CTA style;
- preferred caption length;
- hashtag strategy;
- emoji preference;
- humor level;
- formality level;
- preferred visual style;
- posting cadence;
- minimum approval level;
- auto-publish policy;
- authentication status;
- permissions/scopes status.

Company and CEO data must remain logically separated even if they refer to the same event.

---

## 6. Onboarding Inputs

The system should support an onboarding wizard that gathers organization data, brand assets, CEO persona information, social-account details, posting preferences, approval policies, media policies, infrastructure constraints, and any legal/compliance requirements.

Unknown fields should remain explicitly unknown. Claude must not invent brand facts merely to complete onboarding.

---

## 7. Historical Data Ingestion

Where official APIs permit it, ingest:

- historical posts;
- captions;
- media references;
- timestamps;
- formats;
- platform/account;
- reactions;
- comments;
- shares;
- impressions;
- reach;
- saves;
- clicks/CTR;
- video views;
- watch time;
- follower changes;
- other platform-specific metrics.

Allow CSV/JSON/export imports when APIs cannot provide sufficient history.

Always preserve both the raw metric and any normalized internal interpretation.

Metrics from different platforms must not be falsely treated as identical.

---

## 8. Historical Post Feature Extraction

For each historical post derive structured content, visual, timing, platform, goal, and performance features.

Examples include content pillar, topic, campaign, event, caption length, hook, CTA, hashtag use, format, photo count, visible people, natural photography vs designed artwork, text overlays, posting time, event-to-post delay, raw metrics, normalized metrics, and rolling-baseline performance.

Avoid simplistic conclusions from small sample sizes.

Distinguish correlation from causation.

---

## 9. Performance Intelligence

The learning layer should determine which combinations of topic, format, creative style, timing, platform, caption structure, hook, CTA, and account identity correlate with useful outcomes.

Do not reduce success to likes alone.

Maintain goal-oriented scores for awareness, engagement, conversation, traffic, video retention, follower growth, recruiting, brand positioning, and other relevant objectives.

A recruiting post should not be evaluated against exactly the same objective as a product launch.

---

## 10. Weekly Media Intake

The team should create a **Weekly Content Batch** containing photos, videos, event folders, product screenshots, notes, campaign briefs, participant names/titles where appropriate, and other supporting material.

Claude and the media pipeline should automatically:

- find duplicates and near-duplicates;
- group media by likely event;
- identify weak/blurry assets;
- identify hero images;
- identify supporting images;
- avoid repetitive selections;
- infer likely event context;
- identify privacy/brand risks;
- propose event names/summaries.

Never identify unknown people by guessing who they are.

---

## 11. Best-Photo Selection

Evaluate media based on technical quality, composition, clarity, storytelling value, uniqueness, brand visibility, facial expression where relevant, crop suitability, carousel diversity, privacy/safety, relevance, and patterns learned from historical performance.

The selection must remain explainable.

---

## 12. Creative Transformation

Support three levels.

### Level A — Deterministic enhancement

Crop, resize, straighten, exposure correction, color correction, denoise, sharpen, safe background cleanup, branding, frames, typography, thumbnails, subtitles, video trimming, audio normalization, and format conversion.

### Level B — Trend-aware treatment

Examples include scribble/annotation layouts, editorial cards, tasteful corporate humor, scrapbook treatments, polaroid layouts, timelines, quote cards, event carousels, before/after formats, and statistic overlays.

These examples are not permanent trends. The trend engine should discover what is currently relevant.

### Level C — Generative treatment

Examples include illustrations, approved avatars, concept artwork, generative backdrops, and compositing.

Generative editing must not falsify documentary events or create misleading representations.

---

## 13. Trend Intelligence

Every trend candidate should have platform, evidence/source, discovery timestamp, freshness, momentum, likely lifespan, audience fit, company fit, CEO fit, complexity, IP risk, reputational risk, and recommended adaptation.

Use a model such as:

`Trend Opportunity = Freshness × Platform Fit × Audience Fit × Brand Fit × Feasibility × Novelty – Risk`

Stale trends should automatically expire.

Do not build prohibited scraping systems.

---

## 14. Content Planning Engine

After media analysis, generate a weekly content plan using:

- desired post counts;
- available media/events;
- historical performance;
- content pillar balance;
- event freshness;
- trends;
- campaign priorities;
- audience fatigue;
- recent topics;
- platform fit;
- company vs CEO fit.

Avoid posting every event on every account merely because media is available.

---

## 15. Post Option Generation

Generate **2–4 materially different options** for every planned post.

Each should contain:

- objective;
- creative concept;
- selected media;
- media ordering;
- editing treatment;
- platform-specific output;
- caption;
- hook;
- CTA;
- hashtags;
- mentions/placeholders;
- accessibility/alt text;
- recommended publishing time;
- reasoning;
- confidence;
- risks/notes.

The options should differ strategically rather than being simple wording variations.

---

## 16. Company vs CEO Voice

Company content should usually be more polished, brand-aware, consistent, inclusive, and structured.

CEO content should generally feel first-person, personal, reflective, opinionated where appropriate, people-oriented, and human.

These are defaults only.

The system must learn the real historical voice.

A CEO post must not sound like a corporate post where “we” has simply been replaced with “I.”

---

## 17. Caption Rules

Captions must have platform-appropriate hooks, natural human language, accurate facts, varied structure, controlled hashtags, intentional CTAs, accessible formatting, and identity-specific tone.

Avoid generic AI clichés.

Never invent quotations, statistics, names, event details, partnerships, awards, or claims.

---

## 18. Scheduling Intelligence

Publishing-time recommendations should prioritize the account’s own history, followed by platform, format, geography/timezone, urgency, audience behavior, recent publishing density, and campaign restrictions.

Generic benchmark data should be fallback evidence rather than the primary strategy.

The system should return a recommended **window with confidence**, rather than pretending it knows a guaranteed “best time.”

Users must retain the ability to publish immediately, accept the recommendation, choose another time, or save a draft.

---

## 19. Publishing Workflow

Use the state machine:

`INGESTED → ANALYZED → PLANNED → DRAFTED → RENDERED → READY_FOR_REVIEW → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED → MEASURING → LEARNED`

Additional states include:

`REJECTED`, `NEEDS_CHANGES`, `FAILED`, `PAUSED`, `EXPIRED`.

Before every external write action verify the identity, account, platform, creative, caption, schedule, permissions, idempotency key, and approval record.

Retries must never generate duplicate posts.

Each platform target must have independent status so partial failures are visible.

---

## 20. Analytics Feedback Loop

Collect suitable post-publish snapshots such as early, 24-hour, 72-hour, 7-day, and later/final snapshots where useful.

Store raw analytics.

Compare results with rolling baselines and similar historical posts.

Record actual vs expected outcomes.

Learn from both performance and user behavior, including which option was selected, rejected, edited, rescheduled, or regenerated.

---

## 21. Experiments

Support controlled experiments such as caption length, image selection, CEO framing, carousel vs single image, CTA differences, visual treatments, and publishing windows.

Every experiment should record a hypothesis, variable, control, objective metric, sample size, result, confidence, and decision.

Never overfit after one post.

---

## 22. Dashboard

Eventually provide:

- Weekly Command Center;
- Weekly Media Inbox;
- Content Planner/Calendar;
- Post Studio;
- Analytics;
- Account Connections;
- Brand/Persona Settings;
- Publishing Policies;
- Tool/MCP Health;
- Audit Log.

The UX should minimize repetitive work.

---

## 23. Core Data Model

Plan for entities including:

`workspace`, `user`, `role`, `social_identity`, `social_account`, `oauth_connection`, `brand_profile`, `persona_profile`, `content_pillar`, `media_asset`, `media_variant`, `weekly_batch`, `event`, `historical_post`, `post_metric_snapshot`, `post_feature`, `trend_signal`, `content_plan`, `post_candidate`, `creative_variant`, `caption_variant`, `approval`, `scheduled_job`, `published_post`, `experiment`, `recommendation`, `audit_event`, and `tool_connection`.

Use stable internal IDs rather than platform IDs as primary keys.

---

## 24. Architecture Principles

Separate the system into:

**Intelligence:** Claude reasoning, multimodal analysis, planning, captioning, ranking, and orchestration.

**Connectors:** Meta/Instagram/Facebook/LinkedIn official API adapters.

**Media:** storage, metadata, thumbnails, deterministic editing, video processing, and optional generation.

**Data:** relational database, analytics history, object storage, cache/queue where justified.

**Workflow:** scheduling, durable background jobs, retries, idempotency, analytics collection, and token maintenance.

**Application:** web dashboard, RBAC, approvals, calendar, studio, settings, and audit trail.

**Observability:** logs, metrics, traces, connector health, job state, publishing errors, model/tool usage, and alerts.

Do not hide critical business rules exclusively inside prompts.

---

## 25. MCP Strategy

MCP should act as a secure tool boundary.

Potential read tools include account discovery, historical post retrieval, analytics, weekly media access, asset metadata, brand knowledge, trends, and calendars.

Potential creation tools include content-plan persistence, post candidate creation, deterministic rendering, carousel rendering, video processing, and preview generation.

Write tools may include scheduling, publishing, cancellation, and analytics refresh.

High-risk tools such as publishing must require explicit account identifiers, strict schemas, idempotency keys, approval references, permission validation, and audit logging.

Never place broad permanent social tokens directly into model context.

---

## 26. Security Requirements

Require encryption, secure secret storage, least privilege, token lifecycle handling, RBAC, signed URLs, environment separation, protected production publishing, backups, dependency scanning, vulnerability management, rate limiting, secure webhooks, correct OAuth redirects, audit logs, and privacy-aware retention.

Model-generated identifiers must never bypass server-side authorization.

Separate read and write scopes.

---

## 27. Privacy and Brand Safety

Respect ownership and consent.

Do not infer sensitive personal traits.

Do not fabricate testimonials or executive quotes.

Do not create misleading documentary event edits.

Support asset-level “do not use” controls.

Trend relevance never overrides brand trust.

---

## 28. Reliability

Gracefully handle token expiry, revoked permissions, rate limits, API changes, platform outages, malformed media, upload failures, worker restarts, duplicate requests, partial publishing failures, missing analytics, deprecated metrics, broken MCP servers, render failures, and empty weekly uploads.

Use durable state, safe retries, backoff, dead-letter handling, and idempotency.

---

## 29. Quality Gates

Content cannot become review-ready unless the account, platform, goal, media, caption, factual grounding, duplicate check, formatting, schedule recommendation, and source traceability have been validated.

Publishing requires an approval record unless an explicit workspace policy allows otherwise.

---

## 30. Explainability

Every recommendation should answer “why?”

Explain why particular media, captions, platforms, accounts, creative styles, trends, and time windows were recommended.

Avoid meaningless opaque numbers such as “AI score 92” without supporting evidence.

---

## 31. Product Success Metrics

Measure both social performance and operational efficiency.

Social outcomes should include relevant reach, impressions, engagement, conversation, traffic, video retention, follower growth, and campaign outcomes.

Operational metrics should include upload-to-calendar time, manual work saved, option acceptance rate, regeneration frequency, schedule adherence, publishing reliability, duplicate rate, overrides, and account-connection health.

The objective is **better and more consistent content with less manual work**, not simply more posts.

---

## 32. Forbidden Shortcuts

Do not build fake-engagement systems, follower bots, mass-comment systems, password automation, personal-profile posting hacks, copyright-copy workflows, uncontrolled autonomous publishing, prohibited trend scraping, fake event generation, or an architecture where important state only exists in a chat conversation.

---

## 33. Delivery Phases

### Phase 0
Platform feasibility, account types, APIs, scopes, app reviews, and baseline data.

### Phase 1
Account onboarding, historical ingestion, analytics normalization, media storage, and audit foundation.

### Phase 2
Historical intelligence, weekly uploads, event grouping, photo selection, content planning, and 2–4 draft concepts.

### Phase 3
Deterministic media editing, carousel rendering, video processing, trend-aware creative treatments, and previews.

### Phase 4
Scheduling recommendations, approvals, publishing, retries, idempotency, and calendar.

### Phase 5
Post-publish measurement, user-choice learning, experimentation, and stronger predictive ranking.

### Phase 6
Policy-controlled autonomy only after governance and reliability have been proven.

---

## 34. How Claude Should Behave

Claude must:

1. Read this context before major project decisions.
2. Verify current platform capabilities using official sources.
3. Clearly label assumptions.
4. Never invent API permissions.
5. Prefer first-party data.
6. Keep company and CEO identities separate.
7. Use Claude for intelligence and tools for execution.
8. Prefer mature self-hostable/open-source supporting components after license verification.
9. Avoid overengineering.
10. Make publishing actions auditable, idempotent, and least-privileged.
11. Preserve raw analytics.
12. Respect sample-size uncertainty.
13. Make content options genuinely different.
14. Adapt output by platform.
15. Explain recommendations.
16. Maintain architecture decision records.
17. Maintain known limitations.
18. Maintain a platform capability matrix.
19. Maintain a changelog of assumptions.
20. Research before guessing.

---

## 35. Information Still Needed

Create explicit placeholders for company name, CEO name, industry, products/services, website, target markets, account IDs/URLs, account types, historical data, brand assets, posting cadence, content mix, approval roles, infrastructure preferences, retention rules, generative-image policy, media consent policy, current marketing tools, budget, and internal/public deployment requirements.

Do not block the entire architecture simply because these values have not yet been supplied.

---

## 36. North-Star User Story

> On Monday, the team uploads two folders from last week’s events plus several product screenshots. The system groups and cleans the media, identifies the strongest shots, recognizes that one event is better suited to a company LinkedIn recap and a CEO LinkedIn reflection, creates 2–4 strong options for each, produces Instagram/Facebook variants where appropriate, explains why each option should work, and proposes a weekly calendar. The team selects the preferred creative and caption, approves it, and the system publishes it through compliant official integrations. Later, performance is compared with relevant historical content and those results improve the following week’s recommendations.

That experience is the standard every product and architecture decision should move toward.
