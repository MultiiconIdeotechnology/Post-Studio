import { config } from "../config.js";
import { flux, ideogram, kling } from "./fal.js";
import { gemini } from "./gemini.js";
import { openai } from "./openai.js";
import type { ImageProvider } from "./provider.js";

// Midjourney has no official API, so it is deliberately absent. Add it here if that changes.
const providers: ImageProvider[] = [flux, gemini, openai, ideogram, kling];

export function listProviders() {
  return providers.map((p) => ({ id: p.id, label: p.label, configured: p.configured(), capabilities: p.capabilities, default: p.id === config.DEFAULT_IMAGE_PROVIDER }));
}

export function getProvider(id?: string): ImageProvider {
  const wanted = id ?? config.DEFAULT_IMAGE_PROVIDER;
  const p = providers.find((x) => x.id === wanted);
  if (!p) throw new Error(`Unknown image provider "${wanted}"`);
  if (!p.configured()) throw new Error(`${p.label} is not configured: add its API key to the environment`);
  return p;
}

export function anyProviderConfigured(): boolean {
  return providers.some((p) => p.configured());
}
