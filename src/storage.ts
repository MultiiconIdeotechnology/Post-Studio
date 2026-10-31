import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { config } from "./config.js";
import { query, one } from "./db/index.js";

// Media lives on a local volume (/data/media) and is served at /media/<key>.
// Instagram needs a public URL at publish time, so PUBLIC_BASE_URL must reach this server.

export interface MediaAsset {
  id: string;
  plan_id: string | null;
  kind: "upload" | "generated" | "edited" | "render";
  provider: string | null;
  prompt: string | null;
  source_asset_id: string | null;
  storage_key: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
  meta: Record<string, unknown>;
  created_at: string;
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function mediaUrl(key: string): string {
  return `${config.PUBLIC_BASE_URL.replace(/\/$/, "")}/media/${key}`;
}

export function mediaPath(key: string): string {
  return join(config.MEDIA_DIR, key);
}

export async function saveAsset(input: {
  buffer: Buffer;
  mime?: string;
  kind: MediaAsset["kind"];
  planId?: string | null;
  provider?: string | null;
  prompt?: string | null;
  sourceAssetId?: string | null;
  meta?: Record<string, unknown>;
  // Instagram accepts JPEG only, so renders and generated images are stored as JPEG.
  forceJpeg?: boolean;
}): Promise<MediaAsset> {
  let buffer = input.buffer;
  let mime = input.mime ?? "image/jpeg";
  const image = sharp(buffer, { failOn: "none" });
  const info = await image.metadata();
  if (input.forceJpeg && mime !== "image/jpeg") {
    buffer = await image.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    mime = "image/jpeg";
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const existing = await one<MediaAsset>("select * from media_asset where sha256 = $1 and kind = $2", [
    sha256,
    input.kind,
  ]);
  if (existing) return existing;
  const key = `${new Date().toISOString().slice(0, 10)}/${sha256.slice(0, 16)}.${EXT[mime] ?? "bin"}`;
  await mkdir(join(config.MEDIA_DIR, key.split("/")[0]), { recursive: true });
  await writeFile(mediaPath(key), buffer);
  const rows = await query<MediaAsset>(
    `insert into media_asset (plan_id, kind, provider, prompt, source_asset_id, storage_key, mime, bytes, width, height, sha256, meta)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
    [
      input.planId ?? null,
      input.kind,
      input.provider ?? null,
      input.prompt ?? null,
      input.sourceAssetId ?? null,
      key,
      mime,
      buffer.length,
      info.width ?? null,
      info.height ?? null,
      sha256,
      input.meta ?? {},
    ],
  );
  return rows[0];
}

export async function getAsset(id: string): Promise<MediaAsset | null> {
  return one<MediaAsset>("select * from media_asset where id = $1", [id]);
}

export async function readAsset(asset: MediaAsset): Promise<Buffer> {
  return readFile(mediaPath(asset.storage_key));
}

export async function deleteAsset(asset: MediaAsset): Promise<void> {
  await unlink(mediaPath(asset.storage_key)).catch(() => undefined);
  await query("delete from media_asset where id = $1", [asset.id]);
}

export function publicAsset(a: MediaAsset) {
  return { id: a.id, url: mediaUrl(a.storage_key), kind: a.kind, provider: a.provider, prompt: a.prompt, width: a.width, height: a.height, mime: a.mime, meta: a.meta };
}
