import sharp from "sharp";
import { ASPECT_SIZE, type Aspect } from "./provider.js";

// Image models still misspell words and distort logos, so text and the wordmark are
// composited here, deterministically, on top of the generated or edited image.

export interface Overlay {
  kicker?: string;
  headline?: string;
  body?: string;
  // Where the text block sits; the image brief asks the model to leave room there.
  position?: "bottom" | "top";
  tone?: "dark" | "light"; // text colour scheme over the image
  showWordmark?: boolean;
  pageLabel?: string; // e.g. "1 / 4"
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Approximate wrap by character count; the SVG font is Inter-like and ~0.52em per char.
function wrap(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const par of text.split("\n")) {
    let line = "";
    for (const w of par.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${w}` : w;
      if (t.length > maxChars && line) {
        out.push(line);
        line = w;
      } else line = t;
    }
    if (line) out.push(line);
  }
  return out;
}

export function overlaySvg(aspect: Aspect, o: Overlay): string {
  const { width: W, height: H } = ASPECT_SIZE[aspect];
  const P = Math.round(W * 0.078);
  const fg = o.tone === "light" ? "#121a33" : "#ffffff";
  const sub = o.tone === "light" ? "#3b4256" : "#d6d9e3";
  const accent = "#f2a33a";
  const headSize = 72;
  const bodySize = 32;
  const headLines = o.headline ? wrap(o.headline, Math.floor((W - 2 * P) / (headSize * 0.5))) : [];
  const bodyLines = o.body ? wrap(o.body, Math.floor((W - 2 * P) / (bodySize * 0.5))) : [];
  const blockH = (o.kicker ? 26 + 22 : 0) + headLines.length * headSize * 1.06 + (bodyLines.length ? 26 + bodyLines.length * bodySize * 1.42 : 0);
  const footer = H - 82;
  let y = o.position === "top" ? P + 20 : footer - 60 - blockH;
  const parts: string[] = [];
  if (o.position !== "top" && (headLines.length || bodyLines.length)) {
    parts.push(`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121a33" stop-opacity="0"/><stop offset="0.55" stop-color="#121a33" stop-opacity="0.82"/><stop offset="1" stop-color="#121a33" stop-opacity="0.96"/></linearGradient></defs>`);
    parts.push(`<rect x="0" y="${Math.round(H * 0.38)}" width="${W}" height="${H - Math.round(H * 0.38)}" fill="url(#g)"/>`);
  }
  if (o.kicker) {
    parts.push(`<text x="${P}" y="${y + 26}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="3" fill="${accent}">${esc(o.kicker.toUpperCase())}</text>`);
    y += 48;
  }
  for (const l of headLines) {
    y += headSize;
    parts.push(`<text x="${P}" y="${y}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="${headSize}" font-weight="800" letter-spacing="-1.5" fill="${fg}">${esc(l)}</text>`);
    y += headSize * 0.06;
  }
  if (bodyLines.length) {
    y += 26;
    for (const l of bodyLines) {
      y += bodySize;
      parts.push(`<text x="${P}" y="${y}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="${bodySize}" fill="${sub}">${esc(l)}</text>`);
      y += bodySize * 0.42;
    }
  }
  if (o.showWordmark !== false) {
    parts.push(`<text x="${P}" y="${footer + 20}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="24" font-weight="800" letter-spacing="4.5" fill="${fg}">MULTI<tspan fill="${accent}">I</tspan>CON</text>`);
    parts.push(`<text x="${W - P}" y="${footer + 20}" text-anchor="end" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="${fg}">${esc(o.pageLabel ?? "@multiicon.official")}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
}

// Resize/crop the image to the aspect, then composite the overlay. Output is JPEG (Instagram).
export async function composePost(image: Buffer, aspect: Aspect, overlay: Overlay): Promise<Buffer> {
  const { width, height } = ASPECT_SIZE[aspect];
  const base = await sharp(image).resize(width, height, { fit: "cover", position: "attention" }).toBuffer();
  return sharp(base)
    .composite([{ input: Buffer.from(overlaySvg(aspect, overlay)), top: 0, left: 0 }])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}
