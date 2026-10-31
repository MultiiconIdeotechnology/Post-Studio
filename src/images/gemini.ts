import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";
import type { EditRequest, GenerateRequest, GeneratedImage, ImageProvider } from "./provider.js";

// Gemini image models are the best fit for editing real photos (keeping faces and products
// true) and for blending several references into one scene.

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!config.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
  return client;
}

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

async function call(parts: Part[], aspect: string): Promise<GeneratedImage[]> {
  const res = await getClient().models.generateContent({
    model: config.GEMINI_IMAGE_MODEL,
    contents: [{ role: "user", parts }],
    config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
  });
  const out: GeneratedImage[] = [];
  for (const cand of res.candidates ?? []) {
    for (const p of cand.content?.parts ?? []) {
      const inline = (p as Part).inlineData;
      if (inline?.data) {
        const mime = inline.mimeType.includes("png") ? "image/png" : inline.mimeType.includes("webp") ? "image/webp" : "image/jpeg";
        out.push({ buffer: Buffer.from(inline.data, "base64"), mime, raw: { model: config.GEMINI_IMAGE_MODEL } });
      }
    }
  }
  if (!out.length) throw new Error("Gemini returned no image (the prompt may have been blocked)");
  return out;
}

export const gemini: ImageProvider = {
  id: "gemini",
  label: "Gemini image",
  capabilities: { generate: true, edit: true, typography: false },
  configured: () => !!config.GEMINI_API_KEY,
  async generate(req: GenerateRequest) {
    const parts: Part[] = (req.references ?? []).map((b) => ({ inlineData: { mimeType: "image/jpeg", data: b.toString("base64") } }));
    parts.push({ text: req.prompt });
    const results: GeneratedImage[] = [];
    for (let i = 0; i < (req.n ?? 1); i++) results.push(...(await call(parts, req.aspect)));
    return results;
  },
  async edit(req: EditRequest) {
    return call([{ inlineData: { mimeType: "image/jpeg", data: req.image.toString("base64") } }, { text: req.prompt }], req.aspect ?? "4:5");
  },
};
