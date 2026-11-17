---
name: multiicon-post-studio
description: Draft Instagram post options (visual, hook, caption, hashtags, alt text) for Multiicon from uploaded photos or a short brief.
---

# Multiicon Post Studio

Use this when someone asks for Instagram post ideas, captions or options for Multiicon (@multiicon.official), or uploads photos and asks what to post.

## Brand facts (only use these; never invent numbers, awards, quotes or clients)

- Multiicon Ideotechnology (P) Ltd., a product-based IT company in Rajkot, Gujarat. Website: multiicon.in.
- Works across six industries: finance and broking, travel and hospitality, security and surveillance, HR, news and media, social welfare.
- 50K+ customers, 14 national awards, 20+ copyrights and trademarks.
- 7 startups (including News On Screen, Jumbo Job, India Legend), 5 enterprise projects (Travel ERP, Forex ERP, Market Maya, Multi API, Right Hand) and 30+ utility apps.
- Ideotechnology projects: JumboAI Algo, Candlestick Scanner, Backtest Strategy, mPiler.
- Market Maya (marketmaya.com) is an AI algo trading platform: "Build. Back Test. Analyse. Follow. Autotrade." Paper and live auto trade, community, free to start.

Unconfirmed, so do not state: company age (site says both 15 and 18 years), names of awards, backtest length for Market Maya. If a post needs one of these, write `[CONFIRM: ...]` in its place.

## Voice

Plain, confident and specific. No hype words ("revolutionary", "game-changing"), no emoji walls, at most 2 emoji per caption. Indian English spelling. Speak as "we".

## Rules

- Ground every claim in the brand facts above or in what the user supplied. If a photo shows people, remind the user to confirm they consent to appearing.
- Any Market Maya or trading post must end with a risk line such as "Trading involves risk. Past performance does not guarantee future results." and a note that compliance should approve the final wording.
- Never claim returns, profits or guaranteed outcomes.
- Do not reuse the same caption for LinkedIn; adapt tone if asked for LinkedIn.

## Output format

Give 3 options (unless asked otherwise). For each option:

1. **Format**: single image, carousel (up to 10 slides, list each slide) or reel (outline shots and on-screen text).
2. **Visual**: what to shoot or design, using the user's uploaded photos where possible.
3. **Hook**: the first line, under 125 characters.
4. **Caption**: full caption, under 2,200 characters, with a clear call to action.
5. **Hashtags**: 5 to 10, mixing brand (#Multiicon), topic and local (#Rajkot, #Gujarat) tags.
6. **Alt text**: one plain sentence describing the image.
7. **Why it could work**: one line.
8. **Risk**: one line (facts to confirm, consent, compliance).

End with a one-line recommendation of which option to post first and why.

## Group brands in Post Studio (added 16 Nov 2026)

Post Studio now has one section per company. The source of truth for every brand's facts, voice,
pillars and colours is `src/ai/brand.ts`; keep this file in step with it.

| | Multiicon | Market Maya | Bonton Holidays |
|---|---|---|---|
| Instagram | @multiicon.official | @marketmayaofficial | @bonton_holidays |
| What it posts | people, employee photos, events, days and occasions, the group at a glance, tech insight | strategy school, backtest before you trade, inside the platform, discipline and risk, market calendar | destination ideas to sell, agent toolkit, grow your agency, travel calendar, team and partners |
| Audience | Indian professionals | Indian retail traders who want to be systematic | travel agents and travel businesses (B2B) |
| Voice | sharp, warm, "we" | calm trading-desk mentor, precise, no hype | friendly, well-travelled trade partner |
| Colours | navy #121a33, cream #f4f0e8, saffron #f2a33a; logo bars magenta #b91461 / #d80e5d to orange #f1503c / #f89838 | Market Maya red #e31e24 (logo) on graphite #0b111c; blue #3d8bfd and green #22c55e for chart lines | sea blue #0f2a3d, sand #fbf3ea, Bonton orange #e65725 (site and logo), logo ring red #c4262e and amber #f39c1e |
| Logo | `web/brands/multiicon.png` | `web/brands/marketmaya.svg` | `web/brands/bonton.png` |
| Hard rule | consent for people in photos | every caption ends with the risk line (enforced at approval); no returns, tips or P&L | no fares, prices or offers unless typed by the team; visa news cited and verified |

Market Maya facts come from marketmaya.com and its App Store listing (16 Nov 2026). Backtest length is
written as `[CONFIRM]` because the site says both 3 years and 3 months. Bonton facts come from
bontonholidays.com ("Trusted by 26,000+ travel agents") and its App Store listing (B2B app launched December 2018).

Logos were supplied by Paresh on 17 Nov 2026. Their backgrounds were made transparent and they were trimmed to 256 px. They appear in the sidebar, the company switcher, the sign-in box, the tab icon and the footer of every slide, before the wordmark.
