import sharp from "sharp";
import { claudeConfigured, sampleText } from "../ai/claude.js";
import { ASPECT_SIZE, type GenerateRequest, type GeneratedImage, type ImageProvider } from "./provider.js";

// Works with only ANTHROPIC_API_KEY: Claude designs the visual as SVG (vector art: gradients,
// shapes, abstract scenes, icons, simple illustrations) and the server renders it to PNG.
// It cannot make photographs or photo-real people; real image models do that once their keys
// are added. The headline and wordmark are still added later by compose.ts, so the art has no text.

const PALETTE = "deep navy #121a33, darker navy #0b1022, warm cream #f4f0e8, saffron #f2a33a, with tints and shades of these; one supporting cool accent (teal #2bb3a3 or electric blue #3d7bff) is allowed";

const DESIGN_SYSTEM = `You are the in-house graphic designer for Multiicon, an Indian product-based IT company. You draw finished Instagram post artwork as a single hand-written SVG.
Style: a confident international tech brand. Editorial, modern and calm. Think premium product-launch graphics: layered gradients, soft glows, geometric or isometric shapes, clean flat or 2.5D illustration, subtle grain or grid textures, depth from overlapping translucent layers. One strong focal point and one idea per frame.
Palette: ${PALETTE}. Rich contrast; never washed out or pale.
Never: text, letters, numbers, logos or watermarks (they are added later); clip-art, emoji, stock clichés (handshakes, glowing brains, binary rain, padlocks on circuit boards); photographic people or faces.
Technical rules: one <svg> element with xmlns, the exact width, height and viewBox given; only inline SVG (paths, shapes, gradients, filters such as feGaussianBlur and feTurbulence, patterns, masks, clipPaths); no <image>, <text>, <foreignObject>, <script>, CSS @import or external links; ids unique. Keep it under 20 KB: favour a few well-chosen shapes and gradients over many small ones.
Reply with the SVG only, no explanation.`;

// Strip anything that could reach outside the document or run code before rasterising.
export function sanitizeSvg(raw: string): string {
  const start = raw.indexOf("<svg");
  const end = raw.lastIndexOf("</svg>");
  if (start < 0 || end < 0) throw new Error("Claude did not return an SVG design");
  let svg = raw.slice(start, end + 6);
  svg = svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<image\b[^>]*\/?>(?:<\/image>)?/gi, "")
    .replace(/<text\b[\s\S]*?<\/text>/gi, "")
    .replace(/@import[^;]*;/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/<!ENTITY[^>]*>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    // Only same-document references (#id) are allowed in href / url().
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, "")
    .replace(/url\(\s*['"]?(?!#)[^)]*\)/gi, "none");
  return svg;
}

export async function renderSvg(svg: string, width: number, height: number): Promise<Buffer> {
  return sharp(Buffer.from(svg), { density: 96, limitInputPixels: 50_000_000 })
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();
}

const VARIANTS = [
  "Interpretation A: the most direct, literal reading of the brief.",
  "Interpretation B: a bolder, more abstract or conceptual take with a different composition and focal point.",
  "Interpretation C: a calmer, minimal take with more negative space.",
  "Interpretation D: an isometric or 2.5D illustrated scene.",
];

async function designOne(req: GenerateRequest, variant: string): Promise<GeneratedImage> {
  const { width, height } = ASPECT_SIZE[req.aspect];
  const prompt = `Design the artwork for this Instagram post. Canvas: width="${width}" height="${height}" viewBox="0 0 ${width} ${height}".
The brief below may describe a photo; translate it into vector art in our style rather than imitating a photograph.
Keep the bottom 40% calmer and darker so a headline can sit there in cream text.
${variant}

BRIEF:
${req.prompt}`;
  const text = await sampleText({ system: DESIGN_SYSTEM, prompt, task: "image.claude_design", effort: "medium", maxTokens: 16000 });
  const svg = sanitizeSvg(text);
  const buffer = await renderSvg(svg, width, height);
  return { buffer, mime: "image/png", raw: { model: "claude-svg", variant, svgBytes: svg.length } };
}

export const claudeDesign: ImageProvider = {
  id: "claude",
  label: "Claude design (vector art)",
  capabilities: { generate: true, edit: false, typography: false },
  configured: () => claudeConfigured(),
  async generate(req: GenerateRequest) {
    // Reference photos are ignored: Claude draws from scratch. Use uploaded photos directly instead.
    const n = Math.min(req.n ?? 1, VARIANTS.length);
    return Promise.all(VARIANTS.slice(0, n).map((v) => designOne(req, v)));
  },
};
