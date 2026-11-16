import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { config } from "../config.js";
import type { EditRequest, GenerateRequest, GeneratedImage, ImageProvider } from "./provider.js";

// Gemini image models (Nano Banana 2 by default) are the best fit for editing real photos
// (keeping faces and products true) and for blending several references into one scene.
// Image models have no free tier on the Gemini API: the Google project behind the key must
// have billing turned on, or every call fails with a quota error.

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!config.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  return client;
}

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

// Turn Google's long error bodies into one line a person can act on.
export function explainGeminiError(e: unknown): Error {
  const status = (e as { status?: number }).status;
  const msg = (e as Error).message ?? String(e);
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) {
    if (/free_tier/i.test(msg)) {
      return new Error("Gemini image models need billing: the free tier allows 0 images. Turn on billing for this key's project in Google AI Studio, then try again.");
    }
    return new Error("Gemini rate limit reached. Wait a minute and try again.");
  }
  if (status === 401 || status === 403 || /API key not valid|PERMISSION_DENIED/i.test(msg)) {
    return new Error("Gemini rejected the API key. Check GEMINI_API_KEY in .env.");
  }
  if (status === 404) return new Error(`Gemini model "${config.GEMINI_IMAGE_MODEL}" is not available to this key. Set GEMINI_IMAGE_MODEL in .env.`);
  return new Error(`Gemini image call failed: ${msg.slice(0, 300)}`);
}

async function toPart(buffer: Buffer): Promise<Part> {
  const meta = await sharp(buffer).metadata();
  const mimeType = meta.format === "png" ? "image/png" : meta.format === "webp" ? "image/webp" : "image/jpeg";
  return { inlineData: { mimeType, data: buffer.toString("base64") } };
}

async function call(parts: Part[], aspect: string): Promise<GeneratedImage[]> {
  let res;
  try {
    res = await getClient().models.generateContent({
      model: config.GEMINI_IMAGE_MODEL,
      contents: [{ role: "user", parts }],
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect, imageSize: config.GEMINI_IMAGE_SIZE } },
    });
  } catch (e) {
    throw explainGeminiError(e);
  }
  const out: GeneratedImage[] = [];
  for (const cand of res.candidates ?? []) {
    for (const p of cand.content?.parts ?? []) {
      const inline = (p as Part).inlineData;
      if (inline?.data) {
        const mime = inline.mimeType.includes("png") ? "image/png" : inline.mimeType.includes("webp") ? "image/webp" : "image/jpeg";
        out.push({ buffer: Buffer.from(inline.data, "base64"), mime, raw: { model: config.GEMINI_IMAGE_MODEL, size: config.GEMINI_IMAGE_SIZE } });
      }
    }
  }
  if (!out.length) {
    const reason = res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason;
    throw new Error(`Gemini returned no image${reason ? ` (${reason})` : ""}. Try rewording the prompt.`);
  }
  return out;
}

export const gemini: ImageProvider = {
  id: "gemini",
  label: "Gemini image (Nano Banana)",
  capabilities: { generate: true, edit: true, typography: true },
  configured: () => !!config.GEMINI_API_KEY,
  async generate(req: GenerateRequest) {
    const parts: Part[] = await Promise.all((req.references ?? []).map(toPart));
    parts.push({ text: req.prompt });
    const n = req.n ?? 1;
    const batches = await Promise.all(Array.from({ length: n }, () => call(parts, req.aspect)));
    return batches.flat();
  },
  async edit(req: EditRequest) {
    return call([await toPart(req.image), { text: req.prompt }], req.aspect ?? "4:5");
  },
};
