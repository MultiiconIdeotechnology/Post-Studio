// Brand facts, voice, content pillars and look for every account the studio writes for.
// Keep in step with docs/BRAND_SKILL.md. Only facts listed here (or typed in by the team)
// may be stated in a post. The browser gets this registry from /brands.js; the server adds
// the brand's system prompt itself, so a page cannot drop or change it.

export type BrandId = "multiicon" | "marketmaya" | "bonton";

export interface SlideLook {
  dark: string; // home background for dark slides
  darker: string;
  light: string; // home background for light slides
  accent: string; // appears on every slide
  support: string[];
  subDark: string; // body text on dark
  subLight: string; // body text on light
  placeholder: string; // photo placeholder fill
  fonts: { display: string; text: string };
  style: string; // one paragraph for the slide designer
}

export interface Brand {
  id: BrandId;
  name: string;
  legalName: string;
  role: string; // one line shown in the brand switcher
  account: string; // Instagram handle without @; also plan.account in the database
  handle: string;
  website: string;
  linkedin: string;
  // Wordmark as parts: [text, "ink" | "accent"]. Drawn by the app, the slide footer and the canvas renderer.
  wordmark: [string, "ink" | "accent"][];
  monogram: string;
  logo: string; // file in web/brands/, served at /brands/<file>; drawn in the app and the slide footer
  facts: string;
  voice: string;
  visualDirection: string;
  pillars: { name: string; idea: string }[];
  slide: SlideLook;
  // A line every caption must end with; approval is refused without it (business rule, not a prompt).
  requiredCaptionLine?: string;
  copy: {
    audience: string; // for planning and photo picking
    cadence: string; // how often and what kind of week
    photoStep: string; // step 2 title
    photoNav: string; // short rail label
    photoSub: string;
    eventWord: string; // "event", "trip", "webinar"
    eventNamePh: string;
    eventWhenPh: string;
    eventWhatPh: string;
    eventWhoPh: string;
    trendsPh: string;
    focusPh: string;
    hashtag: string;
    eventAngles: string;
  };
  example: { topic: string; label: string; hook: string; caption: string; hashtags: string[]; alt: string; why: string; risk: string; slide: { template: string; kicker: string; headline: string; body: string } };
}

const COMMON_VOICE_AVOID = `Avoid: em dashes, "in today's fast-paced world", "unlock", "elevate", "dive in", "game-changer", "revolutionary", "seamless", "journey", "embark", stacked rhetorical questions, triple-adjective lists, hashtags inside sentences. At most 2 emoji in a caption.`;

export const RISK_LINE = "Trading involves risk. Past performance does not guarantee future results.";

const multiicon: Brand = {
  id: "multiicon",
  name: "Multiicon",
  legalName: "Multiicon Ideotechnology (P) Ltd.",
  role: "Parent company: people, events, days and occasions",
  account: "multiicon.official",
  handle: "@multiicon.official",
  website: "multiicon.in",
  linkedin: "linkedin.com/company/mulitiicon",
  wordmark: [["MULTI", "ink"], ["I", "accent"], ["CON", "ink"]],
  monogram: "M",
  logo: "multiicon.png",
  facts: `ACCOUNT: @multiicon.official, Instagram of Multiicon Ideotechnology (P) Ltd., a product-based IT company in Rajkot, Gujarat, India. Website multiicon.in. Group companies with their own accounts: Market Maya (@marketmayaofficial) and Bonton Holidays (@bonton_holidays).
FACTS YOU MAY USE (never invent other numbers, awards, quotes, clients or results):
- Works across six industries: finance and broking, travel and hospitality, security and surveillance, HR, news and media, social welfare.
- 50K+ customers, 14 national awards, 20+ copyrights and trademarks.
- 7 startups (including News On Screen, Jumbo Job, India Legend), 5 enterprise projects (Travel ERP, Forex ERP, Market Maya, Multi API, Right Hand) and 30+ utility apps.
- Ideotechnology projects: JumboAI Algo, Candlestick Scanner, Backtest Strategy, mPiler.
- Market Maya (marketmaya.com): AI algo trading platform. "Build. Back Test. Analyse. Follow. Autotrade." Paper and live auto trade, community, free to start.
UNCONFIRMED, write [CONFIRM: ...] instead of stating: company age (the website says both 15 and 18 years), award names, Market Maya backtest length.
RULES: Any Market Maya or trading post ends the caption with "${RISK_LINE}" and its risk field says compliance must approve. Never claim returns or profits. If people appear in photos, the risk field mentions consent.`,
  voice: `VOICE: write like a sharp person on the Multiicon team, not like an AI. Plain, specific, confident, warm. Indian English spelling. Speak as "we".
${COMMON_VOICE_AVOID}
Do: open with a concrete hook under 125 characters that a scroller would stop for; short paragraphs; vary sentence length; one clear call to action (save, share, tag, comment, link in bio). Audience: Indian professionals first, readable for an international audience.`,
  visualDirection: `VISUAL DIRECTION for generated images: the look of a confident international tech brand. Real-feeling photography or clean 3D/graphic scenes, cinematic light, one strong focal point, generous negative space where a headline will be composited later (say which side). Brand palette: deep navy (#121a33), warm cream (#f4f0e8), saffron accent (#f2a33a). Avoid: stock-photo clichés (handshakes, glowing brains, binary rain), text or logos inside the generated image (we add those ourselves), more than one idea per frame.`,
  pillars: [
    { name: "People and culture", idea: "the team, birthdays and work anniversaries, office life, employee photos" },
    { name: "Events", idea: "recaps of our events, awards and visits, told through the team's own photos" },
    { name: "Days and occasions", idea: "festivals, national days and tech days, always tied to one real brand fact" },
    { name: "What we build", idea: "the group at a glance: industries, startups, enterprise projects, group companies" },
    { name: "Tech insight", idea: "one useful idea from AI, security or product building, explained plainly" },
  ],
  slide: {
    dark: "#121a33",
    darker: "#0b1022",
    light: "#f4f0e8",
    accent: "#f2a33a",
    support: ["#d80e5d", "#f1503c"], // from the logo's magenta to orange bars
    subDark: "#c8ccd8",
    subLight: "#3b4256",
    placeholder: "#2a3352",
    fonts: { display: "Inter Display 800", text: "Inter 400" },
    style: "a confident international tech brand: editorial, modern, calm. Deep navy and warm cream are home colours; saffron is the light. The logo's magenta-to-orange bars (#b91461, #d80e5d, #f1503c, #f89838) may appear as a gradient or stripe motif.",
  },
  copy: {
    audience: "a B2B product company with a small team and Indian professionals as the audience; quality over volume",
    cadence: "3 to 5 posts a week is typical; one may be an event recap with the team's photos",
    photoStep: "Event photos",
    photoNav: "Event photos",
    photoSub: "Tell Claude what happened at last week's event and drop in the raw photos. Claude rates them and picks the strongest.",
    eventWord: "event",
    eventNamePh: "e.g. Multiicon Partner Evening 2026",
    eventWhenPh: "e.g. 24 Oct, Rajkot office",
    eventWhatPh: "Who spoke, what was launched or celebrated, one moment people liked",
    eventWhoPh: "e.g. 40 guests: partners, customers and the team",
    trendsPh: "Paste headlines, reels or topics doing well in IT and AI this week",
    focusPh: "e.g. hiring for Flutter developers, a client milestone, a team birthday",
    hashtag: "#Multiicon",
    eventAngles: "a warm thank-you recap carousel, one standout moment told as a short story, and a people-first or behind-the-scenes angle",
  },
  example: {
    topic: "Example from last week (Diwali). Your generated posts replace this.",
    label: "Diwali wish",
    hook: "Six industries, 50K+ customers, one wish this Diwali.",
    caption: "Six industries, 50K+ customers, one wish this Diwali.\n\nFrom brokers and travel agents to newsrooms and social organisations, the people we build for keep India moving. This festival, we wish each of you light, prosperity and a fresh start.\n\nHappy Diwali and a happy New Year from all of us at Multiicon ✨",
    hashtags: ["#HappyDiwali", "#Multiicon", "#Rajkot", "#Gujarat"],
    alt: "Text slide wishing Happy Diwali from Multiicon.",
    why: "Festive posts with a real brand fact get shared more than generic greetings.",
    risk: "None.",
    slide: { template: "text-dark", kicker: "Happy Diwali · Saal Mubarak", headline: "Six industries. 50K+ customers. One wish.", body: "Light, prosperity and a fresh start, from all of us." },
  },
};

const marketmaya: Brand = {
  id: "marketmaya",
  name: "Market Maya",
  legalName: "Market Maya, a Multiicon Ideotechnology product",
  role: "AI algo trading: strategy, backtesting, discipline",
  account: "marketmayaofficial",
  handle: "@marketmayaofficial",
  website: "marketmaya.com",
  linkedin: "linkedin.com/company/market-maya",
  wordmark: [["MARKET", "ink"], ["MAYA", "accent"]],
  monogram: "MM",
  logo: "marketmaya.svg",
  facts: `ACCOUNT: @marketmayaofficial, Instagram of Market Maya (marketmaya.com), an AI algo trading platform built by Multiicon Ideotechnology (P) Ltd., Rajkot, India.
FACTS YOU MAY USE (never invent other numbers, features, brokers, prices, users or results):
- Tagline: "Trade Smarter, Not Harder". Product line: "Build. Back Test. Analyse. Follow. Autotrade."
- Build strategies without coding in a visual builder; use any plugin and build unlimited strategies for free.
- Backtest predefined or custom strategies on historical data.
- Paper trading: free to deploy a strategy for paper trading. Get started free.
- Basket: add several strategies to a basket and deploy them for algo trading with one click.
- Live algo trading through brokers integrated by API; a charting bridge connects to charting platforms.
- Markets: stocks, commodities, futures and options, indices and forex.
- A community of traders and investors to learn from and follow.
UNCONFIRMED, write [CONFIRM: ...] instead of stating: backtest length (the website says both 3 years and 3 months), broker names, pricing or the pay-per-trade model, user or strategy counts, execution speed.
RULES (non-negotiable): every caption ends with "${RISK_LINE}" and every risk field says compliance must approve. Never claim or hint at returns, profits, win rates, accuracy or "guaranteed" anything. No stock tips, targets or buy and sell calls. No screenshots of P&L. Teach the process (testing, discipline, risk control), never promise outcomes. Market events and dates must be [CONFIRM]ed.`,
  voice: `VOICE: a calm, sharp trading-desk mentor who respects the reader's money. Plain, precise, a little dry. Indian English spelling. Speak as "we" for Market Maya and "you" for the trader.
${COMMON_VOICE_AVOID} Also avoid: "to the moon", "easy money", "passive income", "beat the market", rocket or money-bag emoji, hype about AI.
Do: open with a concrete trading situation or a common mistake (under 125 characters); explain one idea per post; use numbers only as clearly hypothetical examples; end with one call to action (save, try paper trading, link in bio). Audience: Indian retail traders and investors who want to be systematic.`,
  visualDirection: `VISUAL DIRECTION for generated images: a precise fintech look. Dark graphite and deep midnight backgrounds, clean chart lines, candlesticks, grids and data panels drawn as abstract graphics (no real tickers, prices or P&L), one strong focal point, space left for a headline. Palette: graphite #0b111c, midnight #101a2c, Market Maya red #e31e24 (from the logo) as the brand accent, with cool blue #3d8bfd and market green #22c55e for chart lines. Avoid: money piles, bulls and bears clichés, lambos, rockets, text or logos inside the image.`,
  pillars: [
    { name: "Strategy school", idea: "one trading concept explained plainly: indicators, entries and exits, position sizing" },
    { name: "Backtest before you trade", idea: "why and how to test a strategy on history and paper trade it first" },
    { name: "Inside the platform", idea: "one Market Maya feature: no-code builder, basket, paper trading, broker bridge, charting bridge" },
    { name: "Discipline and risk", idea: "stop losses, emotions, overtrading, sizing; never promises" },
    { name: "Market calendar", idea: "budget day, policy dates, expiry and market holidays, always marked to verify" },
  ],
  slide: {
    dark: "#0b111c",
    darker: "#060a12",
    light: "#eef3fb",
    accent: "#e31e24", // Market Maya red, from the logo
    support: ["#3d8bfd", "#22c55e"],
    subDark: "#b7c2d6",
    subLight: "#334155",
    placeholder: "#1a2436",
    fonts: { display: "IBM Plex Sans Condensed 700", text: "Inter 400" },
    style: "a precise fintech product: graphite and midnight, Market Maya red as the brand mark (its square-spiral logo), thin chart lines in cool blue, grids and data panels, monospace numbers (IBM Plex Mono). Calm and exact, never flashy. Use the brand red for the brand, not to mean a loss; chart lines stay blue or green.",
  },
  requiredCaptionLine: RISK_LINE,
  copy: {
    audience: "Indian retail traders and investors who want to trade systematically; education first, product second",
    cadence: "3 to 5 posts a week; mostly teaching and product how-tos, at most one market-calendar post",
    photoStep: "Photos and screens",
    photoNav: "Photos and screens",
    photoSub: "Drop photos from a webinar or meetup, or screenshots of the platform (no P&L, no client data). Claude rates them and picks the strongest.",
    eventWord: "webinar or meetup",
    eventNamePh: "e.g. Market Maya backtesting webinar",
    eventWhenPh: "e.g. 12 Nov, online",
    eventWhatPh: "What was taught or shown, one question people asked",
    eventWhoPh: "e.g. 120 traders joined live",
    trendsPh: "Paste market news or topics traders are talking about this week (no tips)",
    focusPh: "e.g. paper trading, the basket feature, a new charting bridge",
    hashtag: "#MarketMaya",
    eventAngles: "a key-takeaways carousel from the session, one question answered properly, and a behind-the-scenes or community angle",
  },
  example: {
    topic: "Example post. Your generated posts replace this.",
    label: "Test first",
    hook: "Would you trade a strategy you have never tested?",
    caption: "Would you trade a strategy you have never tested?\n\nOn Market Maya you build the rules without code, backtest them on historical data, then run them on paper before a single real order goes out.\n\nSave this for your next strategy idea.\n\n" + RISK_LINE,
    hashtags: ["#MarketMaya", "#AlgoTrading", "#Backtesting", "#PaperTrading"],
    alt: "Text slide: build, backtest, paper trade, then go live.",
    why: "Process posts are saved more than market opinions and carry no compliance risk.",
    risk: "Compliance must approve.",
    slide: { template: "text-dark", kicker: "Build. Back Test. Analyse.", headline: "Test it on history before you trust it.", body: "Build without code, backtest, paper trade, then go live." },
  },
};

const bonton: Brand = {
  id: "bonton",
  name: "Bonton Holidays",
  legalName: "Bonton Holidays (P) Ltd.",
  role: "B2B travel portal for travel agents",
  account: "bonton_holidays",
  handle: "@bonton_holidays",
  website: "bontonholidays.com",
  linkedin: "linkedin.com/company/bontonholidays",
  wordmark: [["BONTON", "ink"], [" HOLIDAYS", "accent"]],
  monogram: "B",
  logo: "bonton.png",
  facts: `ACCOUNT: @bonton_holidays, Instagram of Bonton Holidays (P) Ltd. (bontonholidays.com), a B2B travel portal and travel tech company in the Multiicon group, Rajkot, India.
FACTS YOU MAY USE (never invent other numbers, fares, offers, destinations or results):
- B2B travel portal for travel agents, corporate clients and SMEs. "Trusted by 26,000+ travel agents."
- Agents book flights, hotels, holiday packages, visas, bus tickets and forex in one place.
- White label travel website and mobile app so an agent can launch their own branded travel business.
- B2B benefits: discounts and deals for business customers; 24/7 support for bookings and technical help.
- The Bonton Holidays B2B app launched in December 2018 (App Store and Play Store).
UNCONFIRMED, write [CONFIRM: ...] instead of stating: any fare, price, offer or commission, visa rules and processing times, number of hotels or destinations, years in business, office addresses.
RULES: the audience is travel agents, not holidaymakers: every post helps an agent sell, serve or grow. Never quote a price, fare or offer the team has not typed in. Visa or travel-rule news names its source and goes in the risk field to verify. If people appear in photos, the risk field mentions consent.`,
  voice: `VOICE: a friendly, well-travelled partner who knows the trade. Warm, practical, upbeat without hype. Indian English spelling. Speak as "we" to "you" the travel agent.
${COMMON_VOICE_AVOID} Also avoid: "wanderlust", "paradise", "bucket list", "hidden gem", "breathtaking".
Do: open with something an agent can use today (a destination idea, a selling tip, a season to plan for) under 125 characters; be concrete about the destination or the tool; one call to action (save, share with your team, sign up as an agent, link in bio). Audience: travel agents and travel businesses across India.`,
  visualDirection: `VISUAL DIRECTION for generated images: bright, sunny, real-feeling travel photography or clean editorial illustration: destinations, flights and stays, people travelling. Warm light, one strong focal point, space left for a headline. Palette: the logo's ring colours (red #c4262e, Bonton orange #e65725, amber #f39c1e), deep sea blue #0f2a3d, sand #fbf3ea, sky teal #13a5a0. Avoid: stock clichés (suitcase on a beach), fake landmarks, text or logos inside the image.`,
  pillars: [
    { name: "Destination ideas to sell", idea: "a destination, season or trip type an agent can package and sell, with practical selling points" },
    { name: "Agent toolkit", idea: "one Bonton feature: flights, hotels, packages, visa, bus, forex, white label website and app" },
    { name: "Grow your agency", idea: "selling, follow-up and service tips for travel agents" },
    { name: "Travel calendar", idea: "festivals, long weekends and holiday seasons agents should plan for, marked to verify" },
    { name: "Team and partners", idea: "our team, trade events, agent meets and partner stories, with consent" },
  ],
  slide: {
    dark: "#0f2a3d",
    darker: "#0a1d2b",
    light: "#fbf3ea",
    accent: "#e65725",
    support: ["#f39c1e", "#c4262e", "#13a5a0"], // amber and red from the logo ring, teal for sea and sky
    subDark: "#c6d6e0",
    subLight: "#4a3f38",
    placeholder: "#1d3f55",
    fonts: { display: "Inter Display 800", text: "IBM Plex Serif 400" },
    style: "a warm, sunny travel-trade brand: deep sea blue and sand are home colours, Bonton orange is the sun, with the logo ring's red and amber around it. Editorial travel layouts, route lines, boarding-pass and postcard motifs, map dots, soft horizon gradients.",
  },
  copy: {
    audience: "travel agents and travel businesses across India (B2B); every post helps them sell, serve or grow",
    cadence: "3 to 5 posts a week; mix destination ideas, one product feature and one agent tip",
    photoStep: "Trip and event photos",
    photoNav: "Trip photos",
    photoSub: "Drop photos from a trade event, an agent meet or a familiarisation trip. Claude rates them and picks the strongest.",
    eventWord: "event or trip",
    eventNamePh: "e.g. Bonton agent meet, Ahmedabad",
    eventWhenPh: "e.g. 8 Nov, Ahmedabad",
    eventWhatPh: "What happened, who was recognised, one moment people liked",
    eventWhoPh: "e.g. 150 travel agents from Gujarat",
    trendsPh: "Paste destinations, seasons or travel news agents are asking about this week",
    focusPh: "e.g. winter holiday packages, white label app, visa services",
    hashtag: "#BontonHolidays",
    eventAngles: "a thank-you recap carousel for the agents who came, one standout moment as a short story, and a people-first or behind-the-scenes angle",
  },
  example: {
    topic: "Example post. Your generated posts replace this.",
    label: "One login",
    hook: "Flights, hotels, visas and holidays. One login for your agency.",
    caption: "Flights, hotels, visas and holidays. One login for your agency.\n\nBonton Holidays is the B2B travel portal trusted by 26,000+ travel agents. Book everything your clients need in one place, or launch your own branded travel website and app.\n\nShare this with your team ✈️",
    hashtags: ["#BontonHolidays", "#TravelAgents", "#B2BTravel", "#TravelTech"],
    alt: "Text slide: one login for flights, hotels, visas and holidays.",
    why: "A clear, practical promise to agents with a real proof point.",
    risk: "None.",
    slide: { template: "text-dark", kicker: "For travel agents", headline: "One login for every booking.", body: "Flights, hotels, holidays, visa, bus and forex. Trusted by 26,000+ travel agents." },
  },
};

export const BRANDS: Record<BrandId, Brand> = { multiicon, marketmaya, bonton };
export const BRAND_IDS = Object.keys(BRANDS) as BrandId[];
export const DEFAULT_BRAND: BrandId = "multiicon";

export function getBrand(id?: string | null): Brand {
  return (id && BRANDS[id as BrandId]) || BRANDS[DEFAULT_BRAND];
}
export function brandByAccount(account?: string | null): Brand {
  return Object.values(BRANDS).find((b) => b.account === account) ?? BRANDS[DEFAULT_BRAND];
}
export function systemFor(id?: string | null): string {
  const b = getBrand(id);
  return `${b.facts}\n\n${b.voice}\n\n${b.visualDirection}`;
}

// Multiicon exports kept for older imports.
export const BRAND_FACTS = multiicon.facts;
export const VOICE = multiicon.voice;
export const VISUAL_DIRECTION = multiicon.visualDirection;
export const SYSTEM = systemFor("multiicon");
