import { config } from "../config.js";

// Instagram Graph API publishing (docs/PLATFORM_CAPABILITIES.md): create a media container
// per image (carousel children get is_carousel_item), then one container for the post,
// then media_publish. Images must be JPEG at a public URL. There is no schedule parameter,
// so our own scheduler (publish/scheduler.ts) calls this at the right time.

export interface IgPublishResult {
  id: string;
  permalink?: string;
  raw: unknown;
}

export function instagramConfigured(): boolean {
  return !!(config.IG_USER_ID && config.IG_ACCESS_TOKEN);
}

export function instagramStatus() {
  return {
    configured: instagramConfigured(),
    publishEnabled: instagramConfigured() && config.IG_PUBLISH_ENABLED,
    graphVersion: config.IG_GRAPH_VERSION,
  };
}

async function graph<T = Record<string, unknown>>(path: string, params: Record<string, string>, method: "GET" | "POST" = "POST"): Promise<T> {
  const url = new URL(`https://graph.instagram.com/${config.IG_GRAPH_VERSION}/${path}`);
  const body = new URLSearchParams({ ...params, access_token: config.IG_ACCESS_TOKEN! });
  const res = method === "GET" ? await fetch(`${url}?${body}`) : await fetch(url, { method, body });
  const json = (await res.json()) as T & { error?: { message: string; code: number; error_subcode?: number } };
  if (!res.ok || json.error) {
    const e = json.error;
    throw new Error(`Instagram API ${path}: ${e?.message ?? res.statusText} (code ${e?.code ?? res.status}${e?.error_subcode ? `/${e.error_subcode}` : ""})`);
  }
  return json;
}

async function waitUntilFinished(containerId: string): Promise<void> {
  // Containers for images finish quickly, but the API still asks us to poll status_code.
  for (let i = 0; i < 20; i++) {
    const s = await graph<{ status_code?: string; status?: string }>(containerId, { fields: "status_code,status" }, "GET");
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram container ${containerId}: ${s.status ?? s.status_code}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`Instagram container ${containerId} did not finish in time`);
}

export async function publishToInstagram(input: { imageUrls: string[]; caption: string; altTexts?: string[] }): Promise<IgPublishResult> {
  if (!instagramConfigured()) throw new Error("Instagram is not connected (IG_USER_ID / IG_ACCESS_TOKEN missing)");
  if (!config.IG_PUBLISH_ENABLED) throw new Error("Publishing is switched off (IG_PUBLISH_ENABLED=false). Turn it on once the test account has been verified.");
  if (!input.imageUrls.length) throw new Error("No images to publish");
  if (input.imageUrls.length > 10) throw new Error("Instagram carousels hold at most 10 images");
  const user = config.IG_USER_ID!;

  let creationId: string;
  if (input.imageUrls.length === 1) {
    const c = await graph<{ id: string }>(`${user}/media`, {
      image_url: input.imageUrls[0],
      caption: input.caption,
      ...(input.altTexts?.[0] ? { alt_text: input.altTexts[0] } : {}),
    });
    creationId = c.id;
  } else {
    const children: string[] = [];
    for (const [i, url] of input.imageUrls.entries()) {
      const c = await graph<{ id: string }>(`${user}/media`, {
        image_url: url,
        is_carousel_item: "true",
        ...(input.altTexts?.[i] ? { alt_text: input.altTexts[i] } : {}),
      });
      children.push(c.id);
    }
    const c = await graph<{ id: string }>(`${user}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: input.caption });
    creationId = c.id;
  }
  await waitUntilFinished(creationId);
  const pub = await graph<{ id: string }>(`${user}/media_publish`, { creation_id: creationId });
  const info = await graph<{ permalink?: string }>(pub.id, { fields: "permalink" }, "GET").catch(() => ({}) as { permalink?: string });
  return { id: pub.id, permalink: info.permalink, raw: { creationId, pub } };
}
