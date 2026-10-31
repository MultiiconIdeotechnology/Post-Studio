import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { getProvider, listProviders } from "../images/index.js";
import { composePost } from "../images/compose.js";
import { getAsset, publicAsset, readAsset, saveAsset } from "../storage.js";
import { audit } from "../audit.js";

const Aspect = z.enum(["4:5", "1:1", "9:16", "16:9"]);

const GenerateBody = z.object({
  planId: z.string().uuid().optional(),
  provider: z.string().optional(),
  prompt: z.string().min(5).max(4000),
  aspect: Aspect.default("4:5"),
  n: z.number().int().min(1).max(4).default(2),
  referenceAssetIds: z.array(z.string().uuid()).max(4).optional(),
});

const EditBody = z.object({
  planId: z.string().uuid().optional(),
  provider: z.string().optional(),
  assetId: z.string().uuid(),
  prompt: z.string().min(3).max(4000),
  aspect: Aspect.default("4:5"),
});

const ComposeBody = z.object({
  planId: z.string().uuid().optional(),
  assetId: z.string().uuid(),
  aspect: Aspect.default("4:5"),
  overlay: z.object({
    kicker: z.string().max(60).optional(),
    headline: z.string().max(160).optional(),
    body: z.string().max(400).optional(),
    position: z.enum(["bottom", "top"]).optional(),
    tone: z.enum(["dark", "light"]).optional(),
    showWordmark: z.boolean().optional(),
    pageLabel: z.string().max(20).optional(),
  }),
});

export function registerImageRoutes(app: FastifyInstance) {
  app.get("/api/images/providers", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { providers: listProviders() };
  });

  // Browser uploads (raw event photos, or slides rendered in the browser).
  app.post<{ Querystring: { planId?: string; kind?: string } }>("/api/images/upload", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const kind = req.query.kind === "render" ? "render" : "upload";
    const out = [];
    for await (const part of req.files({ limits: { fileSize: 40 * 1024 * 1024, files: 15 } })) {
      const buffer = await part.toBuffer();
      const asset = await saveAsset({ buffer, mime: part.mimetype, kind, planId: req.query.planId ?? null, provider: "browser", forceJpeg: kind === "render" });
      out.push(publicAsset(asset));
    }
    return { assets: out };
  });

  app.post("/api/images/generate", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = GenerateBody.parse(req.body);
    let provider;
    try {
      provider = getProvider(body.provider);
    } catch (e) {
      return reply.code(503).send({ error: "provider_unavailable", message: (e as Error).message });
    }
    const references = [];
    for (const id of body.referenceAssetIds ?? []) {
      const a = await getAsset(id);
      if (a) references.push(await readAsset(a));
    }
    try {
      const images = await provider.generate({ prompt: body.prompt, aspect: body.aspect, n: body.n, references });
      const assets = [];
      for (const img of images) {
        assets.push(await saveAsset({ buffer: img.buffer, mime: img.mime, kind: "generated", planId: body.planId ?? null, provider: provider.id, prompt: body.prompt, forceJpeg: true, meta: { raw: img.raw ?? null, aspect: body.aspect } }));
      }
      await audit("user", "image.generated", "plan", body.planId, { provider: provider.id, n: assets.length });
      return { assets: assets.map(publicAsset) };
    } catch (e) {
      return reply.code(502).send({ error: "generation_failed", message: (e as Error).message });
    }
  });

  app.post("/api/images/edit", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = EditBody.parse(req.body);
    const source = await getAsset(body.assetId);
    if (!source) return reply.code(404).send({ error: "not_found", message: "Source image not found" });
    let provider;
    try {
      provider = getProvider(body.provider ?? "gemini");
      if (!provider.edit) throw new Error(`${provider.label} cannot edit photos; use gemini, flux or openai`);
    } catch (e) {
      return reply.code(503).send({ error: "provider_unavailable", message: (e as Error).message });
    }
    try {
      const images = await provider.edit({ image: await readAsset(source), prompt: body.prompt, aspect: body.aspect });
      const assets = [];
      for (const img of images) {
        assets.push(await saveAsset({ buffer: img.buffer, mime: img.mime, kind: "edited", planId: body.planId ?? source.plan_id, provider: provider.id, prompt: body.prompt, sourceAssetId: source.id, forceJpeg: true, meta: { raw: img.raw ?? null } }));
      }
      return { assets: assets.map(publicAsset) };
    } catch (e) {
      return reply.code(502).send({ error: "edit_failed", message: (e as Error).message });
    }
  });

  // Deterministic text + wordmark overlay; this is what actually goes to Instagram.
  app.post("/api/images/compose", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = ComposeBody.parse(req.body);
    const source = await getAsset(body.assetId);
    if (!source) return reply.code(404).send({ error: "not_found", message: "Source image not found" });
    const out = await composePost(await readAsset(source), body.aspect, body.overlay);
    const asset = await saveAsset({ buffer: out, mime: "image/jpeg", kind: "render", planId: body.planId ?? source.plan_id, provider: "compose", sourceAssetId: source.id, meta: { overlay: body.overlay, aspect: body.aspect } });
    return { asset: publicAsset(asset) };
  });

  app.get<{ Params: { id: string } }>("/api/images/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const a = await getAsset(req.params.id);
    if (!a) return reply.code(404).send({ error: "not_found" });
    return publicAsset(a);
  });
}
