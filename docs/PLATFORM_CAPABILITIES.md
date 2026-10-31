# Platform Capability Matrix (Section B)

**Verification date for every row: 2026-10-28.** Platform APIs change monthly. Re-verify a row before building or changing its connector, and record the re-check date here.

Labels: `CONFIRMED` (read in current official docs), `ASSUMPTION`, `NEEDS VERIFICATION` (plausible or remembered, not re-read today, or needs a live sandbox test), `BLOCKED BY PLATFORM/API`.

## B.0 Sources (official, read on 2026-10-28)

| Id | Source |
|---|---|
| M1 | Meta, Instagram Platform overview: https://developers.facebook.com/docs/instagram-platform/overview |
| M2 | Meta, Instagram content publishing: https://developers.facebook.com/docs/instagram-platform/content-publishing |
| M3 | Meta, Instagram media insights reference: https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/insights |
| M4 | Meta, Instagram insights guide: https://developers.facebook.com/docs/instagram-platform/insights |
| M5 | Meta, Pages API posts: https://developers.facebook.com/docs/pages-api/posts |
| M6 | Meta, Page insights reference: https://developers.facebook.com/docs/graph-api/reference/insights |
| M7 | Meta, Reels publishing (Pages): https://developers.facebook.com/docs/video-api/guides/reels-publishing |
| M8 | Meta, Graph API rate limiting: https://developers.facebook.com/docs/graph-api/overview/rate-limiting |
| M9 | Meta blog, publish_actions deprecation (2018-07-31): https://developers.facebook.com/blog/post/2018/07/31/platform-update-publish-permission/ |
| M10 | Meta, deprecated Page insights metrics (June 15 2026): https://developers.facebook.com/docs/platforminsights/page/deprecated-metrics and Graph API v25 announcement https://developers.facebook.com/blog/post/2026/02/18/introducing-graph-api-v25-and-marketing-api-v25/ (read via the M6 deprecation notice plus a vendor summary; re-read originals before building analytics) |
| L1 | LinkedIn, Community Management overview: https://learn.microsoft.com/linkedin/marketing/community-management/community-management-overview?view=li-lms-2026-10 |
| L2 | LinkedIn, Community Management app review: https://learn.microsoft.com/linkedin/marketing/community-management-app-review?view=li-lms-2026-10 |
| L3 | LinkedIn, Increasing access (permissions and tiers): https://learn.microsoft.com/linkedin/marketing/increasing-access?view=li-lms-2026-10 |
| L4 | LinkedIn, Posts API: https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-10 |
| L5 | LinkedIn, MultiImage API: https://learn.microsoft.com/linkedin/marketing/community-management/shares/multiimage-post-api?view=li-lms-2026-10 |
| L6 | LinkedIn, Videos API: https://learn.microsoft.com/linkedin/marketing/community-management/shares/videos-api?view=li-lms-2026-10 |
| L7 | LinkedIn, Member post statistics: https://learn.microsoft.com/linkedin/marketing/community-management/members/post-statistics?view=li-lms-2026-10 |
| L8 | LinkedIn, Organization share statistics: https://learn.microsoft.com/linkedin/marketing/community-management/organizations/share-statistics?view=li-lms-2026-10 |
| L9 | LinkedIn, Organization follower statistics: https://learn.microsoft.com/linkedin/marketing/community-management/organizations/follower-statistics?view=li-lms-2026-10 |
| L10 | LinkedIn, Rate limiting: https://learn.microsoft.com/linkedin/shared/api-guide/concepts/rate-limits |
| L11 | LinkedIn, Refresh tokens: https://learn.microsoft.com/linkedin/shared/authentication/programmatic-refresh-tokens |
| L12 | LinkedIn, Getting access (open permissions, Share on LinkedIn): https://learn.microsoft.com/linkedin/shared/authentication/getting-access |
| L13 | LinkedIn, Recent Marketing API changes: https://learn.microsoft.com/linkedin/marketing/integrations/recent-changes?view=li-lms-2026-10 |
| L14 | LinkedIn, API partner support FAQ (CM must be the only product on an app): https://learn.microsoft.com/linkedin/shared/linkedin-api-partner-support-guide |

## B.1 Summary verdict per identity

| Identity × platform | MVP verdict | Why |
|---|---|---|
| Company Instagram | **Full automation (read, analytics, publish).** | Requires a Business/Creator professional account. `CONFIRMED` M1, M2. |
| CEO Instagram | **Full automation only if the CEO account is a professional (Creator or Business) account.** Personal account = read nothing, publish nothing. | `CONFIRMED` M1 only covers professional accounts. Converting to Creator is a free in-app switch the CEO makes (`NEEDS VERIFICATION` of any downside for that account, e.g. privacy settings). |
| Company Facebook (Page) | **Full automation, including native scheduling.** | `CONFIRMED` M5, M7. |
| CEO Facebook | **Personal profile: `BLOCKED BY PLATFORM/API`** for publishing and insights. **If the CEO has (or creates) a public-figure Page: full automation like the company Page.** | publish_actions deprecated in 2018 (M9). Reels doc: "You can only publish Reels to Facebook Pages" (M7). |
| Company LinkedIn (organization Page) | **Full automation, after Community Management API vetting.** Development tier is call-capped; Standard tier needs a screencast of the working app. | `CONFIRMED` L1, L2, L3. |
| CEO LinkedIn (member) | **Publishing: yes. Analytics for posts we know the URN of: yes. Reading the CEO's historical post list: `BLOCKED BY PLATFORM/API`** (`r_member_social` is closed). History comes from the CEO's LinkedIn data export plus manual analytics export. | `CONFIRMED` L1 FAQ #6, L7, L13. |

## B.2 Detailed matrix

### Instagram — company and CEO (same API; the account type decides)

| Dimension | Detail | Status |
|---|---|---|
| Required account type | Instagram professional account (Business or Creator). Two API configurations: **Instagram API with Instagram Login** (graph.instagram.com, account need not be linked to a Page) and **Instagram API with Facebook Login for Business** (graph.facebook.com, account linked to a Facebook Page). | `CONFIRMED` M1 |
| Historical post reading | Read the account's own media via the IG User media edge. Paging depth/limit not re-read today. | `NEEDS VERIFICATION` (depth of history returned) |
| Analytics / insights | Media insights: FEED `comments, follows, likes, profile_activity, profile_visits, reach, reposts, saved, shares, total_interactions, views, facebook_views`; REELS adds `ig_reels_avg_watch_time, ig_reels_video_view_total_time, reels_skip_rate, crossposted_views`; STORY `navigation, replies, …`. **Deprecated**: `impressions` (for media after 2024-07-02), `plays`, `clips_replays_count`, `ig_reels_aggregated_all_plays_count` (all versions, 2025-04-21), `video_views`. Media metrics stored up to **2 years**, delayed up to **48 h**; story metrics only **24 h** (capture via `story_insights` webhook). **Insights are not available for media inside a carousel album** (children). Account-level ("user") metrics stored up to **90 days**; some metrics unavailable under **100 followers**. API returns an empty set, not 0, when data is missing. | `CONFIRMED` M3, M4. Album-level (parent) metrics: `NEEDS VERIFICATION`. `online_followers` and demographic metric names: `NEEDS VERIFICATION`. |
| Image publishing | Container → publish. **JPEG only** (MPO/JPS unsupported). Media must be on a publicly reachable URL when Meta fetches it. `alt_text` field available for image posts since 2025-03-24 (not for reels/stories). | `CONFIRMED` M2 |
| Carousel | Up to **10** images/videos/mixed; all cropped to first item's aspect ratio (default 1:1). Counts as one post toward the limit. | `CONFIRMED` M2 |
| Video / Reels / Stories | `media_type=REELS` (optional trial reels via `trial_params`), `media_type=STORIES`. Resumable upload via rupload.facebook.com only for apps using Facebook Login for Business. | `CONFIRMED` M2 |
| Scheduled publishing | **No scheduled-publish parameter documented.** Meta advises apps that let users schedule to enforce the rate limit themselves. → Our scheduler publishes at time T. | `CONFIRMED` M2 (absence) |
| Comments | Read, reply, hide/unhide, delete, enable/disable comments; @mention discovery. Permission `instagram_business_manage_comments` / `instagram_manage_comments`. | `CONFIRMED` M1 |
| OAuth model | IG Login: Business Login for Instagram → Instagram User token. FB Login: Facebook Login for Business → Facebook User token → Page token. Short-lived token 1 h; long-lived 60 days, refreshable before expiry. | `CONFIRMED` M1 |
| Scopes | IG Login: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_insights`, `instagram_business_manage_comments`. FB Login: `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `instagram_manage_comments`, `pages_show_list`, `pages_read_engagement` (+ `ads_management`/`ads_read` only if the user's Business Manager role on the Page requires it). | `CONFIRMED` M1, M2, M3 |
| App review / vetting | **Standard Access** (default) works for accounts the app's business owns/manages; **Advanced Access** (App Review + Business Verification) is needed to serve accounts you don't own or manage. Whether the CEO's account counts as "managed" depends on how it is attached (business portfolio asset or app role). | `CONFIRMED` M1; our eligibility for Standard-only: `NEEDS VERIFICATION` in a live setup |
| Rate limits | Publishing: **100 API-published posts per rolling 24 h** (check `GET /<IG_ID>/content_publishing_limit`). The same page also says 50 in the carousel section — treat **50** as our safe ceiling. General calls: `4800 × impressions` per 24 h (BUC). Error code 80002 on throttle. | `CONFIRMED` M2, M8 (internal inconsistency noted) |
| Blockers | Personal accounts unsupported. Shopping tags, branded-content tags, filters unsupported via API. Product tagging, music selection not available. Collaborator posts: `NEEDS VERIFICATION`. | `CONFIRMED` M2 |
| MVP suitability | Company: **High**. CEO: **High if Creator/Business**, otherwise manual handoff. | — |

### Facebook — company Page and CEO

| Dimension | Company Page | CEO personal profile | CEO public-figure Page |
|---|---|---|---|
| Required account type | Facebook Page; user performs CREATE_CONTENT / MANAGE / MODERATE tasks (ANALYZE for insights). `CONFIRMED` M5, M6 | — | Same as company Page |
| Historical posts | `GET /{page_id}/feed` (or published posts edge). `CONFIRMED` M5 | **`BLOCKED BY PLATFORM/API`** for our use case | Same as company |
| Analytics | Page/post insights; **only last 2 years**; `since/until` windows max **90 days** per request. **June 15 2026**: reach/impression family deprecated for all versions (`page_impressions_unique` → `page_total_media_view_unique`; `post_impressions_unique` → `post_total_media_view_unique`; organic/paid/viral splits, `post_video_views_unique` removed with no replacement). Meta warns replacements are **not 1:1** and **history of removed metrics is no longer returned**. Reels interactions not included in some Page metrics. Permissions `read_insights`, `pages_read_engagement`. `CONFIRMED` M6, M10 | **Blocked** | Same as company |
| Image publishing | `POST /{page_id}/photos` with `url`. `CONFIRMED` M5 | **Blocked** (publish_actions deprecated 2018, M9) | Same |
| Multi-image | Upload photos unpublished then attach to a feed post (`attached_media`). `NEEDS VERIFICATION` (not on the page read today) | Blocked | Same |
| Video / Reels | Reels: `POST /{page_id}/video_reels` start → upload to rupload → finish with `video_state` PUBLISHED/SCHEDULED/DRAFT. 9:16, 1080×1920 rec. (min 540×960), 24–60 fps, **3–90 s**. Limit **30 API-published reels per 24 h** per Page. `CONFIRMED` M7 | "You can only publish Reels to Facebook Pages." `CONFIRMED` M7 | Same |
| Scheduling | **Native**: `published=false` + `scheduled_publish_time`, 10 min–30 days ahead (feed); reels 10 min–29 days. `CONFIRMED` M5, M7 | Blocked | Same |
| Comments/reactions | `pages_manage_engagement`, `pages_read_user_engagement`. `CONFIRMED` M5 | Blocked | Same |
| OAuth | Facebook Login for Business → Page access token. A Business Manager **system user** token is a common server-side option. `NEEDS VERIFICATION` (system-user flow not re-read) | — | Same |
| Scopes | `pages_manage_posts`, `pages_read_engagement`, `pages_read_user_engagement`, `pages_manage_engagement`, `publish_video` (video), `read_insights`, `pages_show_list`. `CONFIRMED` M5, M6, M7 | — | Same |
| Review | Same Standard/Advanced logic as Instagram. `ASSUMPTION` (applies Meta-wide; re-verify for Pages permissions) | — | Same |
| Rate limits | Page token: `4800 × engaged users` per 24 h (BUC), error 80001. `CONFIRMED` M8 | — | Same |
| Fallback | — | **Manual handoff**: system prepares final media + caption, user posts from their phone, pastes the post URL back; metrics entered manually or skipped. Product shows "Manual — API not available" on that identity. | — |
| MVP suitability | **High** | **Manual only** | **High** |

### LinkedIn — company Page and CEO member profile

| Dimension | Company (organization Page) | CEO (member) |
|---|---|---|
| Required account type / role | Organization Page; authenticating member must be ADMINISTRATOR (analytics, `rw_organization_admin`), or ADMINISTRATOR / DIRECT_SPONSORED_CONTENT_POSTER / CONTENT_ADMIN for posting (`w_organization_social`). `CONFIRMED` L4, L8 | The CEO personally authorizes our app (3-legged OAuth). `CONFIRMED` L1 |
| Historical post reading | Posts API `GET /rest/posts?author={orgURN}` (count max 100, sort by CREATED). `r_organization_social`. `CONFIRMED` L4 | **`BLOCKED BY PLATFORM/API`**: `r_member_social` is "a closed permission. We're not accepting access requests at this time." `CONFIRMED` L1. **Fallback**: CEO's LinkedIn data export (posts/shares file) + manual analytics export, imported via CSV. Whether export URNs map to `share`/`ugcPost` URNs usable with the analytics API: `NEEDS VERIFICATION`. |
| Analytics | `organizationalEntityShareStatistics` (impressions, unique impressions, clicks, likes, comments, shares, engagement) — organic only; **time-bound data only within a rolling 12 months**; per-share lifetime stats available. Follower stats (time-bound: 12 months back to 2 days ago; demographics only in lifetime query). Page statistics. Video analytics (watch time, views, viewers). `CONFIRMED` L1, L8, L9 | `memberCreatorPostAnalytics` with `r_member_postAnalytics`: IMPRESSION, MEMBERS_REACHED, REACTION, COMMENT, RESHARE, POST_SAVE, POST_SEND, LINK_CLICKS, PREMIUM_CTA_CLICKS, FOLLOWER_GAINED_FROM_CONTENT, PROFILE_VIEW_FROM_CONTENT; `q=entity` (one post, needs URN) or `q=me` (aggregate). DAILY not supported for several metrics. RESHARE/REACTION/COMMENT "not consistent with UI" in aggregate. Member follower count via `r_member_profileAnalytics`. Member video analytics; VIDEO_PLAY/VIEWER unavailable after one year. `CONFIRMED` L7, L13 |
| Image publishing | Images API upload → Posts API. `CONFIRMED` L4 | Same, author = person URN, `w_member_social`. `CONFIRMED` L4 |
| Multi-image | **MultiImage** organic posts, **2–20 images**, JPG/GIF/PNG, < 36,152,320 px. (Document/"PDF carousel" posts via Documents API also available.) Sponsored "Carousel" is ads-only. `CONFIRMED` L4, L5 | Same |
| Video | Videos API: multipart upload, captions (one English caption file) and thumbnail; **3 s–30 min, 75 KB–500 MB, MP4** per spec page (`fileSizeBytes` schema allows up to 5 GB — treat 500 MB as the ceiling). `CONFIRMED` L6 | Same |
| Scheduled publishing | **No scheduling field in Posts API**; `lifecycleState` PUBLISHED (or DRAFT read via AUTHOR viewContext). → Our scheduler. `CONFIRMED` L4 (absence; `NEEDS VERIFICATION` that no newer field exists) | Same |
| Comments / reactions | Comments, Reactions, Social Metadata APIs (`r/w_organization_social_feed`). Webhooks for social actions **disabled in Development tier**. `CONFIRMED` L1, L3 | `w_member_social_feed` (write). Reading comments on member posts needs `r_member_social` → **blocked**. |
| OAuth | 3-legged authorization code. Access token **60 days**; programmatic refresh token **365 days**, non-sliding: member must re-authorize yearly. LinkedIn may revoke earlier. `CONFIRMED` L11 | Same; the CEO must re-consent at least once a year. |
| Scopes | `r_organization_social`, `w_organization_social`, `rw_organization_admin`, `r_organization_followers`, `r_organization_social_feed`, `w_organization_social_feed`. `CONFIRMED` L3 | `w_member_social`, `w_member_social_feed`, `r_member_postAnalytics`, `r_member_profileAnalytics`, `r_basicprofile`. All included in the Community Management API product. `CONFIRMED` L3 |
| Review / vetting | **Community Management API**: registered legal organization, verified business email, verified org website/domain, app verified by a super admin of the company's LinkedIn Page, **must be the only product on that developer app** (create a dedicated app). Development tier then **Standard tier** (screencast < 5 min of the working app incl. full OAuth, posting, engagement display; privacy policy; test credentials). Rejection = new app and start over. Dev tier must be completed within **12 months**. Vetting survey must be completed within **21 days**. `CONFIRMED` L1, L2, L14 | Same app |
| Rate limits | Dev tier: **500 calls/app/24 h, 100 calls/member/24 h, no BATCH_GET**. Standard tier limits unpublished (visible in Developer Portal → Analytics). Daily reset at midnight UTC; 429 on breach; author-level daily share limit exists. `CONFIRMED` L3, L10 | Same |
| Versioning | `LinkedIn-Version: YYYYMM` and `X-Restli-Protocol-Version: 2.0.0` required. Version 202511 sunsets **2026-11-16**; versions roll off ~12 months after release. Current docs view: 202610. `CONFIRMED` L1, L13 | Same |
| Blockers | Dev-tier caps make historical backfill slow; Standard-tier approval is discretionary. | Historical list blocked; comment reading blocked. |
| MVP suitability | **High once vetted** (critical-path item) | **Publishing + new-post analytics: High. History: CSV import.** |

### B.3 Practical consequences for the design

1. **One scheduler for every platform.** Instagram and LinkedIn have no native scheduling, so our scheduler owns time-of-publish everywhere. Facebook's native scheduling is not used in MVP; one mechanism keeps cancel/edit/idempotency uniform (DECISIONS.md ADR-007).
2. **Media must be reachable by Meta at publish time.** Rendered variants are exposed through short-lived pre-signed URLs (e.g. 60 min). Confirm in the sandbox that Meta's fetcher accepts pre-signed S3 URLs (`NEEDS VERIFICATION`).
3. **Metric catalogue is versioned.** Meta removed metrics in 2025 and 2026 and says replacements are not 1:1. We never compare a deprecated metric with its replacement as if equal (DATA_MODEL.md `metric_definition`).
4. **Pin API versions.** Meta Graph `v25.0` (examples on M2 use v25.0); LinkedIn `202610`. Upgrade on a calendar (ROADMAP.md recurring task).
5. **LinkedIn app topology.** One dedicated developer app holds only the Community Management API product and serves both the company Page and the CEO member. Sign-in for our own users does **not** use LinkedIn (we use the company IdP), so no second product is needed on that app.
6. **CEO LinkedIn history is an import, not an API sync.** The onboarding wizard asks the CEO to download their LinkedIn data export and upload it.
7. **Personal Facebook profile = manual lane.** The product shows the lane as manual and still produces the creative and caption.

### B.4 Re-verification checklist (run before each connector milestone)

- [ ] IG: carousel parent insights metric list; `online_followers`; collaborator tagging; pre-signed URL fetch; 50 vs 100 publish limit.
- [ ] FB: multi-photo `attached_media` flow; system-user token flow; Standard vs Advanced access for our own assets.
- [ ] LinkedIn: no scheduling field in latest version; export URN mapping for CEO history; Standard-tier quotas once granted.
- [ ] All: read changelogs (Meta Graph changelog, LinkedIn Recent Changes) monthly.
