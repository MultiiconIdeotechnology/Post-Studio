import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { extractJson, sampleText } from "../ai/claude.js";
import { getBrand, type Brand } from "../ai/brand.js";
import { renderSvg, sanitizeSvg } from "../images/claude-design.js";

// Claude designs each slide whole: art, layout, typography and the slide's own words, as SVG.
// Step 1 plans a look for the post (one family, every slide different). Step 2 designs the
// slides in parallel. The server then checks the words, checks the text stays on the canvas,
// adds the brand's wordmark itself and renders a 1080x1350 JPEG.

export const W = 1080;
export const H = 1350;
const MARGIN = 56;
const FOOTER = 120; // bottom band kept for the wordmark and page number

// Fonts installed in the container (Dockerfile). Claude may only use these.
export const FONTS = ["Inter", "Inter Display", "IBM Plex Serif", "IBM Plex Sans Condensed", "IBM Plex Mono"];

export interface SlideText {
  kicker?: string;
  headline?: string;
  body?: string;
  template?: string;
}
export interface SlideInput extends SlideText {
  photo?: Buffer; // the user's own photo for this slide, already edited
}
export interface PostInput {
  brand?: string;
  topic: string;
  hook?: string;
  caption?: string;
  slides: SlideInput[];
  mode: "fresh" | "variation";
  previousTheme?: unknown;
}
export interface Theme {
  name: string;
  mood?: string;
  palette?: Record<string, unknown>;
  type?: Record<string, unknown>;
  motifs?: string[];
  slides: { concept: string; technique?: string; layout?: string; mark?: "light" | "dark" }[];
}
export interface SlideResult {
  image?: Buffer;
  error?: string;
}

/* ---------------- prompts ---------------- */

function designerFor(b: Brand): string {
  const l = b.slide;
  return `You are the senior art director and graphic designer for ${b.name} (${b.handle}). ${b.role}. You design Instagram carousels that look hand-made by a top studio: editorial, confident, modern, never template-like.
Brand look: ${l.style}
Brand anchors that every slide keeps: the accent ${l.accent} appears somewhere on every slide; ${l.dark} (dark) and ${l.light} (light) are home colours, with support colours ${l.support.join(" and ")}. A post may bring its own palette around them but must still read as ${b.name}.
House type pairing: display ${l.fonts.display}, text ${l.fonts.text}; a post may vary it within the available fonts.
Fonts available (use only these, by exact family name): ${FONTS.join(", ")}.`;
}

function themePrompt(post: PostInput): string {
  const slides = post.slides
    .map((s, i) => `${i + 1}. ${[s.kicker && `label: ${s.kicker}`, s.headline && `headline: ${s.headline}`, s.body && `body: ${s.body}`, s.photo && "has the team's own photo"].filter(Boolean).join(" | ")}`)
    .join("\n");
  const prev = post.previousTheme ? JSON.stringify(post.previousTheme).slice(0, 3000) : "";
  const modeLine =
    post.mode === "variation" && prev
      ? `Make a VARIATION of the current look below: keep its palette family, type pairing and motifs, but give every slide a new composition and technique.\nCurrent look: ${prev}`
      : prev
        ? `Make a completely NEW look that clearly differs from the current one below: different palette, different type pairing, different motifs and techniques.\nCurrent look (do not repeat): ${prev}`
        : "Create a fresh look that suits this post's subject and mood.";
  return `Plan the visual design of this Instagram post before it is drawn.
Topic: ${post.topic}
Hook: ${post.hook ?? ""}
Caption (for mood only): ${(post.caption ?? "").slice(0, 600)}
Slides:
${slides}

${modeLine}

Rules for the plan:
- The slides are one family (shared palette logic, type pairing, a recurring motif) but EVERY slide must look one of a kind: no two slides may share the same layout or technique.
- Choose techniques per slide from a wide range and mix them: bold typographic poster, layered gradient mesh with soft blur, glassmorphism card over glowing shapes, isometric or 2.5D "3D" object built from shaded polygons, flat editorial illustration, duotone or framed treatment of the team's photo, split-colour block layout, data or diagram graphic, oversized number, line art, grain and noise texture, cut-out paper shapes, grid and dot patterns.
- A slide with the team's photo must feature that photo prominently.
- Pick a palette with real contrast (never pale or washed out) and say exact hex values.
- For each slide say whether the bottom band behind the wordmark will be dark or light ("mark": "light" means light wordmark on a dark area).
Reply with only JSON:
{"name":"2-4 word name of the look","mood":"one line","palette":{"background":["#hex",...],"ink":"#hex","accent":"#hex (the brand accent)","support":["#hex",...]},"type":{"display":"font family + weight","text":"font family + weight"},"motifs":["..."],"slides":[{"concept":"what this slide shows and how","technique":"main technique","layout":"where text and art sit","mark":"light|dark"}]}
The slides array must have exactly ${post.slides.length} entries, in order.`;
}

function slidePrompt(post: PostInput, theme: Theme, i: number, feedback?: string): string {
  const b = getBrand(post.brand);
  const s = post.slides[i];
  const plan = theme.slides[i] ?? theme.slides[theme.slides.length - 1];
  const words = [
    s.kicker && `LABEL (small, uppercase allowed): ${JSON.stringify(s.kicker)}`,
    s.template === "number" && s.kicker && `The label is a big number on this slide: ${JSON.stringify(s.kicker)}`,
    s.headline && `HEADLINE: ${JSON.stringify(s.headline)}`,
    s.body && `BODY: ${JSON.stringify(s.body)}`,
    s.template === "cta" && `CALL TO ACTION LINE: "Follow ${b.handle}"`,
  ]
    .filter(Boolean)
    .join("\n");
  return `Design slide ${i + 1} of ${post.slides.length} for this post as one SVG.
Post look: ${JSON.stringify({ name: theme.name, mood: theme.mood, palette: theme.palette, type: theme.type, motifs: theme.motifs })}
This slide's plan: ${JSON.stringify(plan)}

The words on this slide, exactly as written (do not add, drop, translate or reword anything; you may change letter case and split lines):
${words || "(no words: a pure visual slide)"}
${s.photo ? `\nThe team's photo for this slide is attached. Place it with <image href="photo:1" x=".." y=".." width=".." height=".." preserveAspectRatio="xMidYMid slice"/> (you may clip it, frame it, mask it or lay colour over it). Do not draw a copy of it.` : ""}

Technical rules:
- One <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-mark="light|dark"> element. data-mark says whether the wordmark the server adds in the bottom band should be light or dark.
- Keep the bottom ${FOOTER}px band free of words and busy detail (background, gradient or texture only). The server adds the ${wordmarkText(b)} wordmark and the page number there, so never draw a logo, wordmark, handle or page number yourself (except the call-to-action line above).
- All words go in <text> elements positioned with x and y, lines as <tspan x=".." dy="..">. No transform on <text> or on any group that contains text; no textPath. Keep every word at least ${MARGIN}px inside the left, right and top edges and above the bottom band.
- SVG has no automatic wrapping: break lines yourself. Width guide per character: Inter 800 about 0.58 x font-size, Inter 400 about 0.52, IBM Plex Serif about 0.5, IBM Plex Sans Condensed about 0.44, IBM Plex Mono 0.6. Keep each line inside ${W - 2 * MARGIN}px.
- Headline at least 56px, body at least 30px, label at least 24px, so it reads on a phone.
- Allowed: shapes, paths, gradients, patterns, masks, clipPaths, filters (feGaussianBlur, feTurbulence, feDropShadow, feColorMatrix, feBlend, feOffset, feMerge). Not allowed: <script>, <foreignObject>, CSS @import, external links, other <image> elements.
- Make it look premium and finished. Aim for under 25 KB.
${feedback ? `\nYour previous attempt had a problem. Fix it: ${feedback}` : ""}
Reply with the SVG only.`;
}

/* ---------------- checks ---------------- */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function svgWords(svg: string): string[] {
  const texts = svg.match(/<text\b[\s\S]*?<\/text>/gi) ?? [];
  return texts.flatMap((t) => words(decode(t.replace(/<[^>]+>/g, " "))));
}

function words(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^\p{L}\p{N}@.'%+#-]+/u)
    .map((w) => w.replace(/^[.'\-#]+|[.'\-]+$/g, ""))
    .filter(Boolean);
}

// Only the slide's own words may appear (rule: no invented facts), and most of them must.
export function checkWords(svg: string, s: SlideText, index: number, total: number, brand?: string): string | null {
  const b = getBrand(brand);
  const allowed = new Set(words([s.kicker, s.headline, s.body, `follow ${b.handle} ${b.name} ${wordmarkText(b)}`, `${index + 1} ${total}`].filter(Boolean).join(" ")));
  const found = svgWords(svg);
  const extra = [...new Set(found.filter((w) => !allowed.has(w)))];
  if (extra.length) return `these words are not in the slide text and must be removed: ${extra.slice(0, 12).join(", ")}`;
  const need = words([s.headline, s.body].filter(Boolean).join(" "));
  const have = new Set(found);
  const missing = [...new Set(need.filter((w) => !have.has(w)))];
  if (need.length && missing.length > Math.max(1, need.length * 0.1)) return `these words of the headline or body are missing: ${missing.slice(0, 12).join(", ")}`;
  return null;
}

// Render only the words, in black, and find where they land. Catches lines that run off the
// canvas or into the wordmark band.
export async function checkTextBounds(svg: string): Promise<string | null> {
  const texts = svg.match(/<text\b[\s\S]*?<\/text>/gi) ?? [];
  if (!texts.length) return null;
  const only = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><style>text,tspan{fill:#000 !important;stroke:none !important;filter:none !important;opacity:1 !important}</style>${texts.join("")}</svg>`;
  const { data, info } = await sharp(Buffer.from(only)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return "the words did not render: use plain <text> with a listed font family";
  const tol = 16;
  const problems = [];
  if (minX < MARGIN - tol) problems.push(`text starts ${minX}px from the left edge`);
  if (maxX > W - MARGIN + tol) problems.push(`text runs to ${maxX}px, past the right margin at ${W - MARGIN}px: break lines earlier or use a smaller size`);
  if (minY < MARGIN - tol) problems.push(`text starts ${minY}px from the top`);
  if (maxY > H - FOOTER + tol) problems.push(`text reaches y=${maxY}, into the bottom band that starts at ${H - FOOTER}`);
  return problems.length ? problems.join("; ") : null;
}

/* ---------------- wordmark ---------------- */

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

// Logo files live in web/brands (also served to the browser). src/design and dist/design both
// sit two levels under the repo root.
const BRANDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "web", "brands");
const logoCache = new Map<string, string | null>();
export function logoDataUri(b: Brand): string | null {
  if (!logoCache.has(b.id)) {
    try {
      const buf = readFileSync(join(BRANDS_DIR, b.logo));
      const mime = b.logo.endsWith(".svg") ? "image/svg+xml" : "image/png";
      logoCache.set(b.id, `data:${mime};base64,${buf.toString("base64")}`);
    } catch {
      logoCache.set(b.id, null);
    }
  }
  return logoCache.get(b.id)!;
}

export function wordmarkText(b: Brand): string {
  return b.wordmark.map(([t]) => t).join("");
}

export function footerSvg(mark: "light" | "dark", label: string, brand?: string): string {
  const b = getBrand(brand);
  const fg = mark === "light" ? "#ffffff" : b.slide.dark;
  const y = H - 62;
  const wm = b.wordmark.map(([t, c]) => `<tspan fill="${c === "accent" ? b.slide.accent : fg}">${esc(t)}</tspan>`).join("");
  const logo = logoDataUri(b);
  const logoSize = 44;
  const logoEl = logo ? `<image href="${logo}" x="${MARGIN + 28}" y="${y - 33}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>` : "";
  const textX = MARGIN + 28 + (logo ? logoSize + 14 : 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${logoEl}<text x="${textX}" y="${y}" font-family="Inter, sans-serif" font-size="24" font-weight="800" letter-spacing="4.5" fill="${fg}" xml:space="preserve">${wm}</text>
<text x="${W - MARGIN - 28}" y="${y}" text-anchor="end" font-family="Inter, sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="${fg}">${esc(label)}</text>
</svg>`;
}

/* ---------------- pipeline ---------------- */

const THEME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "mood", "palette", "type", "motifs", "slides"],
  properties: {
    name: { type: "string" },
    mood: { type: "string" },
    palette: {
      type: "object",
      additionalProperties: false,
      required: ["background", "ink", "accent", "support"],
      properties: { background: { type: "array", items: { type: "string" } }, ink: { type: "string" }, accent: { type: "string" }, support: { type: "array", items: { type: "string" } } },
    },
    type: { type: "object", additionalProperties: false, required: ["display", "text"], properties: { display: { type: "string" }, text: { type: "string" } } },
    motifs: { type: "array", items: { type: "string" } },
    slides: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["concept", "technique", "layout", "mark"],
        properties: { concept: { type: "string" }, technique: { type: "string" }, layout: { type: "string" }, mark: { type: "string", enum: ["light", "dark"] } },
      },
    },
  },
};

// Used only if planning fails twice, so the slides still get designed.
function fallbackTheme(n: number, brand?: string): Theme {
  const b = getBrand(brand);
  const techniques = ["bold typographic poster with layered gradient mesh and soft blur", "glass card over glowing shapes with a simple diagram", "split-colour block layout with line art", "isometric 2.5D object built from shaded polygons", "oversized number with grid and dot pattern", "editorial layout with grain texture and cut-out shapes", "duotone frame and thin rules", "data graphic with clean bars and labels"];
  return {
    name: `${b.name} house look`,
    mood: "confident, calm, modern",
    palette: { background: [b.slide.dark, b.slide.darker], ink: "#ffffff", accent: b.slide.accent, support: [b.slide.light, ...b.slide.support] },
    type: { display: b.slide.fonts.display, text: b.slide.fonts.text },
    motifs: ["fine grid", "accent dot"],
    slides: Array.from({ length: n }, (_, i) => ({ concept: "show the slide's idea simply", technique: techniques[i % techniques.length], layout: "words on the left, art on the right or above", mark: i % 3 === 1 ? "dark" : "light" })),
  };
}

export async function planTheme(post: PostInput): Promise<Theme> {
  const images = post.slides.filter((s) => s.photo).slice(0, 4).map((s) => ({ data: s.photo!, mime: "image/jpeg" as const }));
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await sampleText({ system: designerFor(getBrand(post.brand)), prompt: themePrompt(post), images, task: "design.theme", effort: "medium", maxTokens: 32000, schema: THEME_SCHEMA });
      const theme = extractJson<Theme>(text);
      if (theme && Array.isArray(theme.slides) && theme.slides.length) {
        // Pad or trim so every slide has a plan.
        while (theme.slides.length < post.slides.length) theme.slides.push(fallbackTheme(post.slides.length, post.brand).slides[theme.slides.length]);
        theme.slides = theme.slides.slice(0, post.slides.length);
        return theme;
      }
    } catch (e) {
      console.error(`[design] theme attempt ${attempt} failed: ${(e as Error).message}`);
    }
  }
  return fallbackTheme(post.slides.length, post.brand);
}

async function photoDataUri(photo: Buffer): Promise<string> {
  const jpg = await sharp(photo).rotate().resize(1350, 1350, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString("base64")}`;
}

// Everything after Claude's reply: sanitise, check the words and their placement, swap in the
// photo, render, add the wordmark. Returns the JPEG, or the problem to send back to Claude.
export async function finishSlide(reply: string, s: SlideInput, i: number, total: number, brand?: string): Promise<{ image: Buffer } | { problem: string }> {
  const b = getBrand(brand);
  let svg: string;
  try {
    svg = sanitizeSvg(reply, { allowPhotos: !!s.photo, allowText: true });
  } catch {
    return { problem: "the reply did not contain an <svg> element" };
  }
  const problem = checkWords(svg, s, i, total, brand) ?? (await checkTextBounds(svg));
  if (problem) return { problem };
  if (s.photo) {
    const uri = await photoDataUri(s.photo);
    svg = svg.replace(/(href\s*=\s*["'])photo:\d+(["'])/gi, `$1${uri}$2`);
  }
  const mark = /data-mark\s*=\s*["']dark["']/i.test(svg.slice(0, 400)) ? "dark" : "light";
  const art = await renderSvg(svg, W, H);
  const label = total > 1 ? `${i + 1} / ${total}` : b.handle;
  const image = await sharp(art)
    .composite([{ input: Buffer.from(footerSvg(mark, label, brand)), top: 0, left: 0 }])
    .flatten({ background: b.slide.dark })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  return { image };
}

export async function designSlide(post: PostInput, theme: Theme, i: number): Promise<Buffer> {
  const s = post.slides[i];
  const total = post.slides.length;
  const images = s.photo ? [{ data: await sharp(s.photo).resize(768, 768, { fit: "inside" }).jpeg().toBuffer(), mime: "image/jpeg" as const }] : [];
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let text: string;
    try {
      text = await sampleText({ system: `${designerFor(getBrand(post.brand))}\n\n${getBrand(post.brand).facts}`, prompt: slidePrompt(post, theme, i, feedback), images, task: "design.slide", effort: "medium", maxTokens: 32000 });
    } catch (e) {
      // A cut-off or failed reply gets another go; rate limits are already retried by the SDK.
      feedback = (e as { code?: string }).code === "truncated" ? "the reply was cut off before </svg>: use fewer, simpler shapes and stay under 20 KB" : undefined;
      console.error(`[design] slide ${i + 1} attempt ${attempt} failed: ${(e as Error).message}`);
      if (attempt === 3) throw e;
      continue;
    }
    const r = await finishSlide(text, s, i, total, post.brand);
    if ("image" in r) return r.image;
    feedback = r.problem;
    if (attempt === 3) throw new Error(`Slide ${i + 1} could not be designed cleanly (${feedback})`);
  }
  throw new Error(`Slide ${i + 1} could not be designed`);
}

// Small pool so a whole week does not hit the API rate limit at once.
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 4) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

export async function designPost(post: PostInput): Promise<{ theme: Theme; slides: SlideResult[] }> {
  const theme = await slot(() => planTheme(post));
  const slides = await Promise.all(
    post.slides.map((_, i) =>
      slot(() => designSlide(post, theme, i)).then(
        (image) => ({ image }),
        (e: Error) => ({ error: e.message }),
      ),
    ),
  );
  return { theme, slides };
}
