import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { ZodError } from "zod";
import { config } from "./config.js";
import { migrate } from "./db/migrate.js";
import { pool } from "./db/index.js";
import { registerAuth } from "./auth.js";
import { registerAiRoutes } from "./routes/ai.js";
import { registerImageRoutes } from "./routes/images.js";
import { registerPlanRoutes } from "./routes/plans.js";
import { claudeConfigured } from "./ai/claude.js";
import { listProviders } from "./images/index.js";
import { instagramStatus } from "./publish/instagram.js";
import { startScheduler, stopScheduler } from "./publish/scheduler.js";

export async function buildServer() {
  const app = Fastify({ logger: { level: config.NODE_ENV === "production" ? "info" : "debug" }, bodyLimit: 60 * 1024 * 1024 });
  await app.register(fastifyCookie);
  await app.register(fastifyMultipart);

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: "bad_request", message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
    app.log.error(err);
    const e = err as { statusCode?: number; message?: string };
    const status = e.statusCode ?? 500;
    return reply.code(status).send({ error: "server_error", message: e.message ?? "Unexpected error" });
  });

  app.get("/healthz", async () => {
    await pool.query("select 1");
    return { ok: true };
  });

  // What is switched on; the UI uses this to enable or stub buttons.
  app.get("/api/status", async () => ({
    claude: { configured: claudeConfigured(), model: config.CLAUDE_MODEL },
    images: listProviders(),
    instagram: instagramStatus(),
    publicBaseUrl: config.PUBLIC_BASE_URL,
    timezone: config.TIMEZONE,
  }));

  registerAuth(app);
  registerAiRoutes(app);
  registerImageRoutes(app);
  registerPlanRoutes(app);

  await mkdir(config.MEDIA_DIR, { recursive: true });
  await app.register(fastifyStatic, { root: config.MEDIA_DIR, prefix: "/media/", decorateReply: false, immutable: true, maxAge: "365d" });

  const here = dirname(fileURLToPath(import.meta.url));
  // dist/server.js and src/server.ts both sit one level under the repo root.
  const webDir = join(here, "..", "web");
  await app.register(fastifyStatic, { root: webDir, prefix: "/", decorateReply: true });

  return app;
}

async function main() {
  const applied = await migrate();
  if (applied.length) console.log(`Applied migrations: ${applied.join(", ")}`);
  const app = await buildServer();
  await startScheduler();
  await app.listen({ port: config.PORT, host: config.HOST });
  const shutdown = async () => {
    await app.close();
    await stopScheduler();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
