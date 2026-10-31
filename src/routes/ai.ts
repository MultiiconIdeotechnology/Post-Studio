import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ClaudeError, claudeConfigured, sampleJson, sampleText } from "../ai/claude.js";
import { SYSTEM } from "../ai/brand.js";
import { requireAuth } from "../auth.js";

// The browser never holds an API key. It sends prompts here; the brand system prompt is
// added server-side so it cannot be dropped or altered from the page.

const Body = z.object({
  prompt: z.string().min(1).max(200_000),
  tier: z.enum(["quick", "default", "complex"]).optional(),
  task: z.string().max(60).optional(),
  // Base64 JPEG/PNG images for photo scoring. The browser downsizes them first.
  images: z.array(z.object({ mime: z.enum(["image/jpeg", "image/png", "image/webp"]), data: z.string() })).max(10).optional(),
});

function errorReply(e: unknown) {
  if (e instanceof ClaudeError) return { status: e.code === "rate_limited" ? 429 : e.code === "not_configured" ? 503 : 502, body: { error: e.code, message: e.message, text: e.text } };
  return { status: 500, body: { error: "server_error", message: e instanceof Error ? e.message : String(e) } };
}

export function registerAiRoutes(app: FastifyInstance) {
  app.post("/api/ai/text", { bodyLimit: 60 * 1024 * 1024 }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!claudeConfigured()) return reply.code(503).send({ error: "not_configured", message: "ANTHROPIC_API_KEY is not set on the server" });
    const body = Body.parse(req.body);
    try {
      const text = await sampleText({ prompt: body.prompt, system: SYSTEM, tier: body.tier, task: body.task ?? "text", images: body.images?.map((i) => ({ mime: i.mime, data: Buffer.from(i.data, "base64") })) });
      return { text };
    } catch (e) {
      const r = errorReply(e);
      return reply.code(r.status).send(r.body);
    }
  });

  app.post("/api/ai/json", { bodyLimit: 60 * 1024 * 1024 }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!claudeConfigured()) return reply.code(503).send({ error: "not_configured", message: "ANTHROPIC_API_KEY is not set on the server" });
    const body = Body.parse(req.body);
    try {
      const value = await sampleJson({ prompt: body.prompt, system: SYSTEM, tier: body.tier, task: body.task ?? "json", images: body.images?.map((i) => ({ mime: i.mime, data: Buffer.from(i.data, "base64") })) });
      return { value };
    } catch (e) {
      const r = errorReply(e);
      return reply.code(r.status).send(r.body);
    }
  });
}
