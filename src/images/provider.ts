// One interface for every image model. The app calls these directly with API keys from the
// environment; no MCP hop is needed inside the server. Add a provider by implementing
// ImageProvider and registering it in ./index.ts.

export type Aspect = "4:5" | "1:1" | "9:16" | "16:9";

export interface GenerateRequest {
  prompt: string;
  aspect: Aspect;
  n?: number;
  // Optional reference photos (e.g. the real event photo to restyle or extend).
  references?: Buffer[];
}

export interface EditRequest {
  image: Buffer;
  prompt: string;
  aspect?: Aspect;
}

export interface GeneratedImage {
  buffer: Buffer;
  mime: "image/jpeg" | "image/png" | "image/webp";
  // Whatever the provider returned, kept for debugging and audit.
  raw?: unknown;
}

export interface ImageProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities: { generate: boolean; edit: boolean; typography: boolean };
  configured(): boolean;
  generate(req: GenerateRequest): Promise<GeneratedImage[]>;
  edit?(req: EditRequest): Promise<GeneratedImage[]>;
}

export const ASPECT_SIZE: Record<Aspect, { width: number; height: number }> = {
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

export async function fetchImage(url: string): Promise<GeneratedImage> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: ${res.status} ${url}`);
  const type = res.headers.get("content-type") ?? "image/jpeg";
  const mime = type.includes("png") ? "image/png" : type.includes("webp") ? "image/webp" : "image/jpeg";
  return { buffer: Buffer.from(await res.arrayBuffer()), mime };
}

export function dataUrl(buffer: Buffer, mime = "image/jpeg"): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
