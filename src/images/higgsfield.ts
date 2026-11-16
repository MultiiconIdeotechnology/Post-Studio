import { config } from "../config.js";
import { type Aspect, type GenerateRequest, type GeneratedImage, type ImageProvider, fetchImage } from "./provider.js";

// Higgsfield's own API (docs.higgsfield.ai). It runs on a prepaid USD balance that is separate
// from the higgsfield.ai website plan: website credits and "Unlimited" models do not apply here.
// Requests are queued: submit, poll status_url, then download images[].url (kept 7 days).
// The default model is Soul 2. Its API has no aspect 4:5, so 3:4 is used and compose crops it.

const BASE = "https://api.higgsfield.ai";
const ASPECT: Record<Aspect, string> = { "4:5": "3:4", "1:1": "1:1", "9:16": "9:16", "16:9": "16:9" };
const TERMINAL = new Set(["completed", "failed", "nsfw", "canceled"]);

type Queued = { status: string; request_id: string; status_url: string };
type Status = { status: string; error?: string; images?: { url: string }[] };

function headers() {
  if (!config.HIGGSFIELD_KEY_ID || !config.HIGGSFIELD_KEY_SECRET) throw new Error("HIGGSFIELD_KEY_ID and HIGGSFIELD_KEY_SECRET are not set");
  return { Authorization: `Key ${config.HIGGSFIELD_KEY_ID}:${config.HIGGSFIELD_KEY_SECRET}`, "Content-Type": "application/json", Accept: "application/json" };
}

export function explainHiggsfieldError(status: number, body: string): Error {
  if (status === 401) return new Error("Higgsfield rejected the API key. Check HIGGSFIELD_KEY_ID and HIGGSFIELD_KEY_SECRET in .env.");
  if (status === 402 || /balance|insufficient|credit/i.test(body)) return new Error("Higgsfield API balance is too low. Top up in the Higgsfield console (website plan credits do not apply to the API).");
  if (status === 404 || status === 423 || status === 503) return new Error(`Higgsfield model "${config.HIGGSFIELD_IMAGE_MODEL}" is not available right now (${status}).`);
  if (status === 429) return new Error("Higgsfield rate limit reached. Wait a minute and try again.");
  return new Error(`Higgsfield call failed (${status}): ${body.slice(0, 300)}`);
}

async function hf<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: headers() });
  const text = await res.text();
  if (!res.ok) throw explainHiggsfieldError(res.status, text);
  return JSON.parse(text) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateOnce(req: GenerateRequest, batch: number): Promise<GeneratedImage[]> {
  const body = { prompt: req.prompt, aspect_ratio: ASPECT[req.aspect], resolution: "1080p", batch_size: batch };
  const queued = await hf<Queued>(`${BASE}/${config.HIGGSFIELD_IMAGE_MODEL}`, { method: "POST", body: JSON.stringify(body) });
  const deadline = Date.now() + 5 * 60_000;
  let st: Status = { status: queued.status };
  let wait = 2000;
  while (!TERMINAL.has(st.status)) {
    if (Date.now() > deadline) throw new Error(`Higgsfield did not finish within 5 minutes (request ${queued.request_id})`);
    await sleep(wait);
    wait = Math.min(wait * 1.5, 8000);
    st = await hf<Status>(queued.status_url);
  }
  if (st.status === "nsfw") throw new Error("Higgsfield blocked this image as unsafe. Try rewording the prompt.");
  if (st.status !== "completed") throw new Error(`Higgsfield request ${st.status}${st.error ? `: ${st.error}` : ""}`);
  const urls = (st.images ?? []).map((i) => i.url);
  if (!urls.length) throw new Error("Higgsfield finished but returned no image");
  const images = await Promise.all(urls.map(fetchImage));
  return images.map((img) => ({ ...img, raw: { requestId: queued.request_id, model: config.HIGGSFIELD_IMAGE_MODEL } }));
}

export const higgsfield: ImageProvider = {
  id: "higgsfield",
  label: "Higgsfield (Soul 2)",
  capabilities: { generate: true, edit: false, typography: false },
  configured: () => !!(config.HIGGSFIELD_KEY_ID && config.HIGGSFIELD_KEY_SECRET),
  async generate(req: GenerateRequest) {
    // Soul accepts batch_size 1 or 4 only.
    const n = req.n ?? 1;
    if (n === 4) return generateOnce(req, 4);
    const runs = await Promise.all(Array.from({ length: n }, () => generateOnce(req, 1)));
    return runs.flat();
  },
};
