import OpenAI, { toFile } from "openai";
import { config } from "../config.js";
import type { Aspect, EditRequest, GenerateRequest, GeneratedImage, ImageProvider } from "./provider.js";

// GPT Image follows long, specific briefs well and handles clean graphic layouts.

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!config.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  client ??= new OpenAI({ apiKey: config.OPENAI_API_KEY });
  return client;
}

const SIZE: Record<Aspect, "1024x1536" | "1024x1024" | "1536x1024"> = {
  "4:5": "1024x1536",
  "9:16": "1024x1536",
  "1:1": "1024x1024",
  "16:9": "1536x1024",
};

function decode(res: { data?: { b64_json?: string }[] }): GeneratedImage[] {
  const out = (res.data ?? []).filter((d) => d.b64_json).map((d) => ({ buffer: Buffer.from(d.b64_json!, "base64"), mime: "image/png" as const, raw: { model: config.OPENAI_IMAGE_MODEL } }));
  if (!out.length) throw new Error("OpenAI returned no image");
  return out;
}

export const openai: ImageProvider = {
  id: "openai",
  label: "GPT Image (OpenAI)",
  capabilities: { generate: true, edit: true, typography: true },
  configured: () => !!config.OPENAI_API_KEY,
  async generate(req: GenerateRequest) {
    const res = await getClient().images.generate({ model: config.OPENAI_IMAGE_MODEL, prompt: req.prompt, n: req.n ?? 1, size: SIZE[req.aspect], quality: "high" });
    return decode(res);
  },
  async edit(req: EditRequest) {
    const file = await toFile(req.image, "image.jpg", { type: "image/jpeg" });
    const res = await getClient().images.edit({ model: config.OPENAI_IMAGE_MODEL, image: file, prompt: req.prompt, size: SIZE[req.aspect ?? "4:5"] });
    return decode(res);
  },
};
