# Known Limitations

Verified 2026-10-28 unless marked. Each limitation is visible in the product, not hidden.

| # | Limitation | Label | Product behaviour |
|---|---|---|---|
| 1 | No API publishing or insights for a **personal Facebook profile** | `BLOCKED BY PLATFORM/API` | Manual lane: ready-to-post package, user posts, pastes URL; metrics manual/optional |
| 2 | No API access for **personal Instagram accounts** (professional accounts only) | `BLOCKED BY PLATFORM/API` | Ask CEO to switch to Creator, else manual lane |
| 3 | CEO **LinkedIn historical post list** not readable (`r_member_social` closed); comments on CEO posts not readable | `BLOCKED BY PLATFORM/API` | Import CEO's LinkedIn data export; analytics API only for posts with known URNs (posts we publish, or imported URNs if they map — `NEEDS VERIFICATION`) |
| 4 | LinkedIn Community Management API requires vetting; Development tier capped at 500 calls/app/day and 100/member/day, no BATCH_GET, no social-action webhooks | `CONFIRMED` | Paced backfill; production waits for Standard tier |
| 5 | LinkedIn org time-bound share statistics only cover a rolling 12 months; member video play/viewer metrics unavailable after 1 year | `CONFIRMED` | Our snapshots become the long-term record |
| 6 | Meta media insights stored max 2 years; IG account metrics 90 days; story metrics 24 h; no insights for children of carousel albums | `CONFIRMED` | Snapshot early and often; per-slide carousel learning impossible via API |
| 7 | Meta removed reach/impression metrics (IG Apr 2025; FB Pages June 15 2026); replacements not 1:1; removed history no longer returned | `CONFIRMED` | Metric catalogue separates eras; trends across the cut are flagged |
| 8 | No native scheduling on Instagram or LinkedIn APIs | `CONFIRMED` | Our scheduler; our uptime matters at post time |
| 9 | Instagram: JPEG only; carousel ≤ 10 items cropped to first item's ratio; no shopping/branded-content tags or filters via API; media URL must be public at publish | `CONFIRMED` | Renderer outputs JPEG; short-lived pre-signed URL |
| 10 | Facebook reels via API: 3–90 s, ≤ 30 API reels per Page per 24 h | `CONFIRMED` | Validator |
| 11 | LinkedIn refresh tokens expire at 365 days regardless of use | `CONFIRMED` | Re-consent reminders |
| 12 | Claude cannot identify people and we will not ask it to | Policy | Names only from user-entered facts |
| 13 | No audio transcription in MVP | Scope | Subtitles only from provided text |
| 14 | Learning is correlational; small accounts produce "insufficient evidence" often | By design | Shown honestly with n and tier |
| 15 | claude.ai support for MCP 2026-07-28 features (Tasks, MCP Apps UI) | `NEEDS VERIFICATION` | Tools work as plain tools; previews open in web app |
