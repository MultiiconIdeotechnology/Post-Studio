# Content Intelligence (Sections F, G, I, J, K, L)

Status: PROPOSED (2026-10-28). All numeric thresholds below are **starting values** to be tuned against real account data; they are marked `ASSUMPTION` where they are judgement calls.

---

## F. Historical learning model

Goal: turn old posts into *descriptive, uncertainty-aware* evidence ("for the CEO on LinkedIn, first-person reflection posts with one photo have tended to reach ~1.6× the CEO's typical post, n=14, moderate confidence"), never into causal claims.

### F.1 Pipeline

```
fetch (API / CSV import) → raw snapshot stored → normalize metrics → features (deterministic + Claude) → baselines → per-post normalized scores per goal → effect estimates per feature (shrunk) → "insight cards" with confidence
```

### F.2 Feature extraction

| Feature group | How extracted | Examples |
|---|---|---|
| Deterministic text | Code | caption_chars, line_breaks, hashtag_count, mention_count, emoji_count, has_link, has_question, first-line length |
| Semantic text | Claude (structured output, prompt-versioned) | pillar, topics, hook_type (`question`,`bold_claim`,`story_open`,`stat`,`announcement`,`gratitude`), cta_type (`none`,`comment`,`link`,`apply`,`register`,`follow`), tone, first_person_singular (CEO signal), mentions_people_roles |
| Visual | Claude vision on stored thumbnails + code metrics | person_count_bucket (0/1/2–5/6+), designed_vs_photo, text_overlay, brand_visible, setting (`stage`,`office`,`outdoor`,`product`,`screen`), visual_style |
| Format/timing | Code | format, media_count, local dow/hour in **identity timezone**, event_to_post_delay_h (if event date known) |
| Context | Code + user | campaign, paid boost flag (exclude boosted posts from organic baselines where detectable) |

### F.3 Metric normalization

Platforms differ, so **scores are computed within (identity, platform, format-family)** and never compared raw across platforms.

1. Pick the metric snapshot closest to a fixed age (e.g. 7 days) — posts are compared at equal age; if a post only has a lifetime value (older history), mark `age_basis=lifetime`.
2. Counts → log: `x = ln(1 + metric)`.
3. Rates use empirical-Bayes shrinkage, e.g. engagement rate on reach:
   `rate_shrunk = (engagements + α) / (reach + α + β)`, where `α, β` are fitted (method of moments) to that identity×platform's history.
4. Robust z-score against the rolling baseline (F.4): `z = (x − median_x) / (1.4826 · MAD_x)`.
5. Percentile within baseline for user-facing language ("top 20% of this account's posts").

### F.4 Rolling baselines and recency

- Baseline = posts of the same identity × platform × format-family in the trailing 180 days excluding the post itself; if n < 12, widen to 365 days, then to all formats on that platform (flagged).
- Recency weight for effect estimation: `w = 0.5^(age_days / 180)` (`ASSUMPTION`: half-life 180 days).
- Baselines stored in `baseline` with window end, n, median, MAD → every score is reproducible.

### F.5 Goal-specific scoring

| Goal | Primary metric(s) (when available) | Secondary |
|---|---|---|
| Awareness | reach / views / unique impressions (z) | follows |
| Engagement | engagement rate shrunk (reactions+comments+shares+saves over reach) | — |
| Conversation | comments (z) and comment rate | replies |
| Traffic | link clicks / CTR (LinkedIn org: clickCount; LinkedIn member: LINK_CLICKS) | — |
| Video retention | IG `ig_reels_avg_watch_time`, `reels_skip_rate`; LinkedIn watch time | views |
| Follower growth | follows / FOLLOWER_GAINED_FROM_CONTENT | profile visits |
| Recruiting / brand positioning | proxy: clicks + comments from relevant audience is **not available** via API → rely on goal-proxy metrics + manual outcome tags | — |

`GoalScore = Σ_m weight_goal,m · z_m` with weights per goal (config, not learned in MVP). Each historical post gets one score per goal; a post is judged by its *declared or inferred* goal only.

### F.6 Similarity

For "posts like this one" and expected-performance estimates, similarity between a draft and history:
`sim = 0.35·[same pillar] + 0.20·Jaccard(topics) + 0.15·[same format] + 0.10·[same hook_type] + 0.10·[same visual setting] + 0.10·[person_count bucket match]`. Embeddings are **not** needed for MVP (Claude-extracted categorical features make this interpretable). Revisit with a local embedding model + pgvector (PostgreSQL License) only if feature similarity proves too coarse.

### F.7 Small-sample handling and confidence

- Effect of a feature level *f* on GoalScore: `Δ_raw = weighted_mean(score | f) − weighted_mean(score | not f)`, `n_f` = effective sample size `(Σw)² / Σw²`.
- Partial pooling: `Δ_shrunk = Δ_raw · n_f / (n_f + k)` with `k = 10` (`ASSUMPTION`).
- Confidence tier from `n_f` and bootstrap 80% interval: **insufficient** (n_f < 5: never shown as a finding), **weak** (5–14), **moderate** (15–39, interval excludes 0), **strong** (≥ 40, interval excludes 0, consistent in both halves of the time window).
- Platform, format, and identity are **never pooled** for effect claims (company LinkedIn evidence never informs CEO LinkedIn claims). Pooling happens only for priors in the scheduler cold start (L.4), and it is labelled.
- Language rule for Claude: findings must say "tended to", give n and tier, and mention obvious confounders (e.g. "most of these were event recaps posted within 24 h").

### F.8 Worked example — one historical post → feature record

Input (LinkedIn CEO post, from the CEO's data export + analytics export; values illustrative):

> "Last Thursday I watched 40 of our engineers spend a whole day teaching school kids to build their first robot. I came for the opening talk and stayed till 6pm. Some of the best questions I've heard this year came from 12-year-olds. Proud of this team. #STEM"
> 1 photo (CEO kneeling beside two students at a table with a robot kit), posted Tue 08:42 IST, event date Thu (5 days earlier).
> Metrics at ~7 days: impressions 9,800, members reached 6,100, reactions 312, comments 41, reshares 9.

Record:

```json
{
  "historical_post_id": "0192…",
  "identity": "ceo", "platform": "linkedin", "format": "image", "media_count": 1,
  "feature_schema_version": 3, "extracted_by_prompt_version": "features.v3.2",
  "text": {"caption_chars": 268, "hashtag_count": 1, "mention_count": 0, "emoji_count": 0,
           "has_question": false, "first_person_singular": true,
           "hook_type": "story_open", "cta_type": "none", "tone": ["reflective","proud"]},
  "semantic": {"pillar": "people_and_culture", "topics": ["csr","stem_education","employees"],
               "event_type": "volunteering"},
  "visual": {"person_count_bucket": "2-5", "designed_vs_photo": "photo", "text_overlay": false,
             "setting": "classroom", "brand_visible": false, "ceo_in_frame": true},
  "timing": {"local_dow": "Tue", "local_hour": 8, "event_to_post_delay_h": 115},
  "metrics_raw_ref": "post_metric_snapshot:0193…",
  "scores": {
    "awareness":  {"z": 1.21, "percentile": 0.86, "baseline": "li-ceo-image-180d", "n_baseline": 31},
    "conversation": {"z": 1.64, "percentile": 0.93},
    "engagement": {"rate_shrunk": 0.0587, "z": 0.98}
  },
  "confidence": {"features": "high", "people_count": "medium (one person partly occluded)"},
  "caveats": ["posted 5 days after event", "single observation, not used alone"]
}
```

Claude never identifies the students or the CEO from the photo; `ceo_in_frame` comes from the account owner's own tag on import or from the user confirming it in the UI.

---

## G. Weekly upload intelligence

```
Upload → dedupe → quality assessment → event grouping → best-photo selection → context extraction → proposed opportunities
```

| Stage | Method | Output |
|---|---|---|
| Upload | Browser → pre-signed multipart PUT direct to originals bucket (private). Server records sha256 after upload (worker computes; client hash trusted only as hint) | `media_asset` rows |
| Exact dedupe | sha256 equal → `duplicate_of_id` | Hidden from selection |
| Near-duplicate | 64-bit pHash + dHash; Hamming ≤ 6 (`ASSUMPTION`) and captured_at within 10 s → same burst cluster; keep best by quality | `near_dup_cluster_id` |
| Video | FFmpeg: probe, extract keyframes at scene changes (≤ 12 per clip), audio loudness (EBU R128), duration | keyframes as derived assets |
| Technical quality | sharp: variance of Laplacian (sharpness), histogram clipping (exposure), noise estimate, resolution vs target (≥1080 px short side for IG feed), face count via Claude vision (counts only) | `quality_tier`: reject/weak/good/hero candidate |
| Event grouping | 1) Time clustering on EXIF `captured_at` (gap > 90 min starts a new cluster), split by GPS distance > 2 km. 2) Claude vision pass per cluster on a contact sheet (≤ 24 thumbnails) → "same event?" + scene labels; Claude may propose merges/splits across clusters. 3) User folder names used as strong hints | `event` with `name_source=inferred` |
| Missing EXIF | Fall back to folder + upload order + Claude visual similarity; mark grouping confidence low | |
| Best-photo selection | Score per image: `0.30·technical + 0.25·storytelling (Claude) + 0.15·composition/crop-suitability (Claude) + 0.10·brand visibility + 0.10·historical style prior (from F: visual features that tend to do well for this identity) + 0.10·uniqueness` minus privacy risk penalty. Hero = argmax; supporting set by **MMR diversity**: pick next image maximizing `λ·score − (1−λ)·max_sim_to_selected`, λ=0.7 | `event_media.role/rank` + explanation strings |
| Weak media | If an event has < 2 good images: propose formats that need less (single quote card, text-led CEO post), or flag "needs better photos" | Opportunity notes |
| Context extraction | Claude reads user instructions, folder names, documents in batch (agendas, briefs) → proposes `event_fact` candidates **with source refs**; user confirms. Unknown people stay "person 1, person 2"; names only from user-entered facts | Fact candidates |
| Privacy/brand risks | Claude flags children, badges/ID cards, screens with data, whiteboards, licence plates, competitor logos, alcohol, safety violations | Risk flags on asset |
| Proposed opportunities | For each event × identity × platform: fit score (J) and suggested angle | Feeds planner |

**Manual corrections** are first-class: move media between events, change hero, edit event name/facts, mark do-not-use. Every correction is stored (`recommendation_feedback`) and used to tune thresholds (e.g. if users often split clusters, lower the time gap).

**Metadata retained per asset**: hashes, EXIF subset (camera, captured_at, GPS only if workspace allows), quality metrics, Claude description (prompt version), consent status, usage history (which posts used it).

---

## I. Trend intelligence

**Sources (compliant only):**

| Source | Access | Cadence |
|---|---|---|
| Official platform newsrooms/creator blogs (Instagram, Meta for Business, LinkedIn Marketing Blog, LinkedIn Engineering) | RSS / Claude `web_search` + `web_fetch` restricted by `allowed_domains` | Weekly |
| Reputable industry press in our sector (domain allow-list chosen with the team) | Claude `web_search` with `allowed_domains` | Weekly |
| Our own accounts: rising comment themes, top recent posts | Platform APIs we already use | Daily with analytics |
| Instagram hashtag search / Business Discovery (public business accounts' public media) | Official API features requiring App Review (Instagram Public Content Access) | Phase 2+ (`NEEDS VERIFICATION` of current limits and review) |
| Team "trend inbox" | Users paste links/screenshots/notes in web app or via MCP | Anytime |
| Google Trends official API | Limited availability (`NEEDS VERIFICATION`) | Deferred |

Explicitly **not**: scraping Instagram/LinkedIn/Facebook pages, logged-in browsing, unofficial APIs, audio-trend scraping.

**Trend record**: platform, format/treatment, description, evidence (URLs + retrieved_at), discovered_at, expires_at, momentum, lifespan class (`flash` 7 d, `seasonal` until date, `format` 60 d), fits, risks.

**Scoring** (each factor 0–1, judged by Claude with rubric + evidence, risks hard-capped):
`Opportunity = Freshness × PlatformFit × AudienceFit × IdentityFit × Feasibility × Novelty − (IPRisk + ReputationalRisk)`
- `Freshness = 0.5^(days_since_discovered / half_life)`, half_life 7 d (flash) or 30 d (format).
- `IdentityFit` computed separately for company and CEO.
- Any risk factor ≥ 0.7 → excluded regardless of score. Trends involving copyrighted audio, characters, memes built on someone else's image → `IPRisk` high by default.
- Expiry: status → `expired` at `expires_at`; job prunes daily. Planner only sees `active` signals.

**Claude context**: planner receives at most 5 active trends per identity, each with evidence summary and score breakdown — not raw web text — to limit prompt-injection surface. Raw fetched text is processed in an isolated call whose only output is the structured trend record.

**Avoiding irrelevant viral chasing**: trend boost in planning is capped at 15% of a slot score (J); a trend can change the *treatment*, not the *facts or pillar balance*; CEO trend use requires `IdentityFit ≥ 0.6`.

---

## J. Content planning algorithm

Inputs: requested post counts per identity×platform, events with media + facts, pillar targets, historical insight cards, recent posting history (fatigue), campaign priorities, trends, existing calendar.

### J.1 Candidate generation

For every (event or evergreen idea) × identity × platform × format-family that is feasible (media meets format minimums; platform lane allows it), create an opportunity *o*.

### J.2 Score

```
S(o, slot) = 0.25·GoalFit
           + 0.20·ExpectedPerf        # similarity-weighted normalized score of similar past posts (F.6), shrunk
           + 0.15·EventFreshness      # 0.5^(hours_since_event / 72); evergreen = 0.5
           + 0.10·PillarGap           # (target_share − recent_share) for the pillar, clipped [0,1]
           + 0.10·IdentityFit         # Claude-judged against persona (CEO: is there a genuine first-person angle?)
           + 0.10·MediaStrength       # hero score of the selected set
           + 0.05·CampaignPriority
           + min(0.15, TrendBoost)
           − 0.20·Fatigue             # same topic/format on same identity×platform in last 14 d (decayed)
           − 0.15·CollisionPenalty    # slot conflicts (L.3)
           − RiskPenalty              # privacy/brand flags (hard exclude if severe)
```
Weights are config (`ASSUMPTION`), tuned later by comparing predicted vs actual normalized outcome.

### J.3 Assignment (greedy with constraints; ILP later if needed)

```text
slots = generate_slots(requested_counts, recommended_windows per identity×platform)  # from L
plan = []
while slots remain and opportunities remain:
    best = argmax over (o, s) of S(o, s) subject to:
        - o.platform == s.platform and o.identity == s.identity
        - not (same event already used on same identity×platform)
        - company and CEO posts about the same event: different angle required, ≥ 2 h apart on same platform
        - per-identity daily cap (default 1/platform/day, ASSUMPTION)
        - pillar share stays within ±15% of target over the week
        - cross-posting: same event on IG + LinkedIn for same identity allowed only with distinct format/caption treatment
    plan.append(best); remove s; decay S of opportunities sharing best.event (diminishing returns)
for slot unfilled: propose evergreen/pillar-gap idea or leave empty with reason
return plan with per-slot score breakdown and reasons
```

Claude then reviews the whole plan in one call (structured output) for coherence, tone mix and anything the numbers miss, and may propose ≤ 3 swaps with reasons; swaps are applied only if they don't violate constraints.

"Avoid posting every event everywhere" is enforced by the diminishing-returns decay and by requiring an `IdentityFit` and `GoalFit` threshold (default 0.4) for a slot to be filled.

---

## K. 2–4 post option generator

### K.1 What "materially different" means

Each option must differ from the others in at least **two** of: objective, creative concept/format, hero media, hook type, narrative structure, CTA type. A deterministic check compares option feature vectors; failing pairs are regenerated.

Typical option archetypes (chosen per slot, not fixed): **Recap carousel** (story through 6–8 images), **Single hero + insight** (one strong image, one idea), **People-first** (team/customer spotlight; names only from facts), **Data/lesson card** (designed card with a verified fact), **CEO reflection** (first-person, one photo, no CTA).

### K.2 Option schema (structured output)

```json
{
  "option_no": 1,
  "objective": "conversation",
  "concept": "CEO reflection on what kids asked",
  "format": "image",
  "media": [{"asset_id": "…", "order": 1, "crop": "4:5 smart", "why": "only shot with CEO and students at eye level"}],
  "edit_recipe_ref": "recipe:li-photo-natural.v2",
  "hook": "The best question I heard this year came from a 12-year-old.",
  "caption": "…",
  "cta": {"type": "comment", "text": "What question would you have asked?"},
  "hashtags": ["#STEM"], "mentions": [{"placeholder": "@company_page", "requires_confirmation": true}],
  "alt_text": ["CEO kneeling beside two students assembling a small robot kit at a classroom table"],
  "recommended_window": {"start": "2026-11-03T08:00+05:30", "end": "2026-11-03T09:30+05:30", "confidence": "moderate"},
  "reasoning": "CEO first-person story posts on LinkedIn reached a median 1.5× baseline (n=14, moderate)…",
  "grounded_claims": [{"text": "40 of our engineers", "fact_id": "event_fact:…"}],
  "confidence": 0.62,
  "risks": ["minors visible: confirm photo consent", "posted 5 days after event"]
}
```

### K.3 Prompt and data strategy (and keeping CEO ≠ corporate)

- **Separate context packs per identity.** CEO generation gets: CEO persona rules, *CEO's own* top/bottom historical posts (10 exemplars each, real text), CEO learned-voice summary (sentence length, pronoun use, typical openings, words they never use), recent CEO posts (for fatigue). **No company posts are included as exemplars for CEO generation**, and vice versa.
- **Voice analysis job** (monthly): Claude summarizes each identity's real historical voice into `persona_profile.learned_voice` with quotes as evidence. Human-entered rules override.
- **Anti-pattern list** per identity (e.g. CEO: no "We are thrilled to announce", no hashtag walls, no marketing CTAs unless the CEO historically uses them; global: generic AI clichés list).
- **Facts sheet only.** Generator receives `event_fact` + `approved_fact` rows; instruction: every factual claim must cite a fact id. Post-check (grounding matcher) rejects ungrounded claims.
- **Critique pass**: a second Claude call scores each option on identity voice match (with the CEO exemplars), platform nativeness, grounding, distinctiveness; low scores trigger one regeneration.
- **Prompt caching**: identity pack + rules are a stable prefix → cached; per-slot data appended after the cache breakpoint.
- **Platform-native rules** are data (per platform: caption length targets, hashtag norms from the identity's own history, line-break style, link handling — e.g. LinkedIn article fields must be set explicitly; IG links are not clickable in captions).
- **Learning from choices**: selected vs rejected options and edit diffs feed a per-identity "preferences" summary injected into the next week's pack (e.g. "CEO shortens hooks; removes emojis").

---

## L. Scheduling model

Output: a **window** (e.g. Tue 08:00–09:30 IST) with confidence and evidence, never a single "best minute".

### L.1 Evidence hierarchy

1. Identity × platform × format history (own data) — primary.
2. Identity × platform (all formats).
3. Audience activity signals if available (`NEEDS VERIFICATION`: IG `online_followers`; LinkedIn follower geo for timezone mix).
4. Generic benchmark prior — **fallback only, labelled as such**.

### L.2 Model

- Buckets: day-of-week × 90-minute window in the **audience's primary timezone** (derived from identity setting and follower geography; multi-timezone audiences get a weighted mix).
- Outcome: early-performance z-score (normalized as in F, at 24–72 h) for the slot's goal.
- Hierarchical shrinkage estimate per bucket:
  `μ_bucket = (n_b·mean_b + k·μ_parent) / (n_b + k)` with parent = same hour across days → identity×platform mean → prior; k = 8 (`ASSUMPTION`). Recency weights as F.4.
- Uncertainty from bootstrap; confidence tier as F.7 using `n_b`.

### L.3 Adjustments

`WindowScore = μ_bucket − CollisionPenalty − DensityPenalty + UrgencyBonus`
- Collision: same identity same platform < 4 h apart; company + CEO on same event and same platform < 2 h apart; > 2 posts same identity same day.
- Density: posts in last 24 h on that identity×platform.
- Urgency: event freshness decays (0.5 per 72 h) → earlier windows get a bonus for time-sensitive events.
- Hard constraints: campaign embargo times, blackout dates, token validity, platform publishing limits (IG ≤ 50/24 h per our safe ceiling; FB reels ≤ 30/24 h).

### L.4 Cold start

If identity×platform has < 20 posts with metrics (`ASSUMPTION`):
- Use the prior: audience-timezone working hours on weekdays (stated as generic, low confidence), plus any own data that exists.
- **Explore deliberately**: Thompson sampling across the top 3 windows for ~20% of slots, logged as an implicit experiment, so the account builds its own evidence.
- UI wording: "Low confidence: based on general patterns, not yet your data (n=4)".

Users can always publish now, accept, pick another time, or save as draft; overrides are recorded and used as soft evidence about team constraints (not about audience behaviour).
