import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { claudeConfigured } from "../ai/claude.js";
import { designPost, type SlideInput } from "../design/post-design.js";
import { getAsset, publicAsset, readAsset, saveAsset } from "../storage.js";
import { audit } from "../audit.js";
import { keepAlive } from "./keepalive.js";

const Body = z.object({
  planId: z.string().uuid().optional(),
  mode: z.enum(["fresh", "variation"]).default("fresh"),
  theme: z.unknown().optional(),
  topic: z.string().max(400).default(""),
  hook: z.string().max(400).optional(),
  caption: z.string().max(3000).optional(),
  slides: z
    .array(
      z.object({
        kicker: z.string().max(120).optional(),
        headline: z.string().max(400).optional(),
        body: z.string().max(800).optional(),
        template: z.string().max(30).optional(),
        photoAssetId: z.string().uuid().optional(),
      }),
    )
    .min(1)
    .max(10),
});

export function registerDesignRoutes(app: FastifyInstance) {
  // Designs every slide of one post option (art and words together). Takes one to three minutes.
  app.post("/api/design/post", { bodyLimit: 1024 * 1024 }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!claudeConfigured()) return reply.code(503).send({ error: "not_configured", message: "ANTHROPIC_API_KEY is not set on the server" });
    const body = Body.parse(req.body);
    const slides: SlideInput[] = [];
    for (const s of body.slides) {
      const a = s.photoAssetId ? await getAsset(s.photoAssetId) : null;
      slides.push({ kicker: s.kicker, headline: s.headline, body: s.body, template: s.template, photo: a ? await readAsset(a) : undefined });
    }
    return keepAlive(
      reply,
      async () => {
        const started = Date.now();
        const out = await designPost({ topic: body.topic, hook: body.hook, caption: body.caption, slides, mode: body.mode, previousTheme: body.theme });
        const results = [];
        for (const r of out.slides) {
          if (!r.image) {
            results.push({ error: r.error ?? "Design failed" });
            continue;
          }
          const asset = await saveAsset({ buffer: r.image, mime: "image/jpeg", kind: "generated", planId: body.planId ?? null, provider: "claude-design", prompt: body.topic, forceJpeg: true, meta: { theme: out.theme.name } });
          results.push(publicAsset(asset));
        }
        await audit("user", "post.designed", "plan", body.planId, { slides: results.length, failed: results.filter((r) => "error" in r).length, ms: Date.now() - started, mode: body.mode });
        return { theme: out.theme, slides: results };
      },
      "design_failed",
    );
  });
}
