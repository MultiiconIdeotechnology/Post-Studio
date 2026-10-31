# Assumptions and Open Questions (Section A + closing item 4)

Last updated 2026-10-28. The planning thread asked about first win, account types, existing developer apps/data, who builds/hosts, and deadline/budget; **no answers had arrived when this was written**, so those items remain open below.

## A.1 Confirmed from project context

| Topic | What we know | Source |
|---|---|---|
| Goal | Claude-first social media intelligence and publishing system for company + CEO across Instagram, Facebook, LinkedIn | Context §1 |
| Identities | Company and CEO are separate identities with separate voice, pillars, analytics, preferences | §1, §5, §16 |
| Human-in-the-loop | Approval required before any external publish in the initial production version; auto-publish never silently enabled | §2.3, §29 |
| Data preference | First-party historical data over generic best practices; preserve raw metrics | §2.4, §7 |
| Infra preference | Mature, self-hostable, licence-verified OSS; official APIs over third-party schedulers | §2.2 |
| Roles | Admin/Marketing Lead, Content team member, CEO, Viewer/Analyst | §4 |
| Workflow states | INGESTED → … → LEARNED plus REJECTED, NEEDS_CHANGES, FAILED, PAUSED, EXPIRED | §19 |
| Snapshots | Early, 24 h, 72 h, 7 d, later | §20 |
| Forbidden | Scraping, password bots, fake engagement, ToS bypass, fabricated facts, uncontrolled autonomy | §32 |
| Creative levels | A deterministic, B template/trend-aware, C generative (no falsified documentary edits) | §12 |
| North-star | Monday upload → grouped media → 2–4 options per post → calendar → approve → publish → measure → improve | §36 |
| User wish | The user controls everything from Claude without hopping between platforms | User message, 2026-10-28 |

## A.2 Unknown but needed

| # | Unknown | Why it matters | Working assumption (label) | Blocks? |
|---|---|---|---|---|
| 1 | Company legal name, website, industry, products/services | LinkedIn CM vetting needs legal entity + website + business email; brand knowledge | `ASSUMPTION`: registered company with a website and business email domain | M0 |
| 2 | CEO name and handles | Identity setup | — | M2 |
| 3 | Company IG account type | Business/Creator required | `ASSUMPTION`: Business, linked to company FB Page | M2 |
| 4 | CEO IG account type | Personal = no API | `ASSUMPTION`: personal today; CEO willing to switch to Creator | M2 (CEO IG) |
| 5 | CEO Facebook: personal profile or Page? | Profile = manual lane only | `ASSUMPTION`: personal profile → manual lane | No (manual lane) |
| 6 | LinkedIn Page super-admins; CEO willing to authorize app yearly | CM vetting + member token | `ASSUMPTION`: marketing lead is super admin | M0 |
| 7 | Existing Meta Business portfolio / developer apps; Business Verification status | Access level, timeline | `ASSUMPTION`: none yet | M0 |
| 8 | Existing LinkedIn developer apps (any with other products) | CM must be the only product on its app | `ASSUMPTION`: create a new app | M0 |
| 9 | Historical data availability (years, exports from Meta Business Suite / LinkedIn) | Learning quality | `ASSUMPTION`: 1–2 years on API + exports for older | No |
| 10 | Posting volume per identity × platform per week | Planner targets | `ASSUMPTION`: company 3 IG / 2 FB / 3 LI; CEO 2 LI / 1 IG | No |
| 11 | Approval roles and policy (who approves CEO content; four-eyes?) | Approval rules | `ASSUMPTION`: Marketing Lead approves company; CEO (or delegate) approves CEO content | No (configurable) |
| 12 | Media/consent rules (minors, employees, customers, events) | Privacy gates | `ASSUMPTION`: consent unknown by default; minors require explicit confirmation | No |
| 13 | Generative image policy | Level C | `ASSUMPTION`: not allowed in MVP | No |
| 14 | Infrastructure preference (cloud vs self-host, region, data residency) | Storage, KMS, hosting | `ASSUMPTION`: one small cloud VM/container service in India region + managed Postgres + S3-compatible storage | M1 |
| 15 | Company IdP (Google Workspace / Microsoft 365) | SSO | `ASSUMPTION`: Google Workspace | M1 |
| 16 | Who builds and operates; deadline; budget (incl. Claude API spend) | Plan pacing | `ASSUMPTION`: Claude builds, one in-house reviewer; no hard deadline | No |
| 17 | Retention / legal requirements (audit duration, deletion requests) | Retention table | `ASSUMPTION`: audit 7 years | No |
| 18 | Brand assets (logo files, fonts with server licences, colours, guidelines) | Templates | `ASSUMPTION`: available on request | M6 |
| 19 | Current marketing tools (schedulers, DAM, Canva, analytics) | Import/export, overlap | Unknown | No |
| 20 | Audience geography and languages per identity | Scheduling timezone, captions | `ASSUMPTION`: India-first, English | No |
| 21 | Claude plan for the team (Pro/Max/Team/Enterprise) | Custom connector availability and admin controls | `ASSUMPTION`: Team or Enterprise | M7 |
| 22 | Internal-only deployment or public URL | OAuth redirect hosts, Meta/LinkedIn app review screencasts | `ASSUMPTION`: internal app on a public HTTPS domain with SSO | M1 |

## Closing item 4 — Information needed from you

### Critical (blocks platform access or architecture)
1. Company legal name, website domain, and a business email that can verify with LinkedIn and Meta.
2. For each account: URL/handle and type — company IG (Business/Creator?), CEO IG (personal/Creator/Business?), company FB Page, CEO Facebook (personal profile or Page?), company LinkedIn Page, CEO LinkedIn profile.
3. Who are the admins: Meta Business portfolio admin, LinkedIn Page super admin. Are there existing Meta/LinkedIn developer apps?
4. CEO decisions: willing to switch IG to Creator; accept "manual lane" for a personal Facebook profile or create a public-figure Page; willing to authorize the LinkedIn app (re-consent yearly).
5. Hosting preference: managed cloud (which) or self-hosted server; any data-residency requirement.
6. A GitHub repository for the code and these docs (create it on GitHub and tell me its name; I'll attach it).

### Useful (improves quality, not blocking)
7. Historical exports: Meta Business Suite exports, LinkedIn Page analytics exports, CEO's LinkedIn data archive.
8. Target posting volume per account per week and content pillars per identity.
9. Approval policy (who approves what; four-eyes for CEO?).
10. Brand kit: logos, fonts (and their licence), colours, tone guidelines, words to avoid; 10–20 CEO posts the CEO considers "most me".
11. Company IdP (Google Workspace / Microsoft 365) and Claude plan type.
12. Media consent rules (employees, customers, minors, events).

### Can wait
13. Generative-image policy.
14. Retention/legal requirements beyond defaults.
15. Existing marketing tools to integrate or replace.
16. Budget ceiling for Claude API spend per month.
