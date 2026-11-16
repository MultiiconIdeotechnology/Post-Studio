import { config } from "../config.js";
import { flux, ideogram, kling } from "./fal.js";
import { gemini } from "./gemini.js";
import { higgsfield } from "./higgsfield.js";
import { openai } from "./openai.js";
import type { ImageProvider } from "./provider.js";

// Midjourney has no official API, so it is deliberately absent. Add it here if that changes.
// Order matters: with no DEFAULT_IMAGE_PROVIDER set, the first configured one is the default.
const providers: ImageProvider[] = [gemini, higgsfield, flux, openai, ideogram, kling];

function defaultId(): string | undefined {
  return config.DEFAULT_IMAGE_PROVIDER || providers.find((p) => p.configured())?.id;
}

export function listProviders() {
  return providers.map((p) => ({ id: p.id, label: p.label, configured: p.configured(), capabilities: p.capabilities, default: p.id === defaultId() }));
}

export function getProvider(id?: string): ImageProvider {
  const wanted = id ?? defaultId();
  if (!wanted) throw new Error("No image model is configured: add GEMINI_API_KEY (or another image key) to .env");
  const p = providers.find((x) => x.id === wanted);
  if (!p) throw new Error(`Unknown image provider "${wanted}"`);
  if (!p.configured()) throw new Error(`${p.label} is not configured: add its API key to the environment`);
  return p;
}

export function anyProviderConfigured(): boolean {
  return providers.some((p) => p.configured());
}
