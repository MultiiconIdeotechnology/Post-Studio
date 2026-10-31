import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";

// One shared password for the studio (APP_PASSWORD) and a signed cookie session.
// Good enough for a single team behind HTTPS; swap for real users when roles are needed.

const COOKIE = "ps_session";
const DAY = 24 * 60 * 60;

function secret(): string {
  return config.SESSION_SECRET ?? config.APP_PASSWORD ?? "dev-only-secret-change-me";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function makeToken(): string {
  const payload = `${Date.now() + 30 * DAY * 1000}`;
  return `${payload}.${sign(payload)}`;
}

export function validToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
  return Number(payload) > Date.now();
}

export function authEnabled(): boolean {
  return !!config.APP_PASSWORD;
}

export function requireAuth(req: FastifyRequest, reply: FastifyReply): boolean {
  if (!authEnabled()) return true;
  if (validToken(req.cookies?.[COOKIE])) return true;
  reply.code(401).send({ error: "unauthorised", message: "Sign in first" });
  return false;
}

export function registerAuth(app: FastifyInstance) {
  app.post<{ Body: { password?: string } }>("/api/auth/login", async (req, reply) => {
    if (!authEnabled()) return { ok: true, authRequired: false };
    const given = req.body?.password ?? "";
    const want = config.APP_PASSWORD!;
    const ok = given.length === want.length && timingSafeEqual(Buffer.from(given), Buffer.from(want));
    if (!ok) {
      await new Promise((r) => setTimeout(r, 800));
      return reply.code(401).send({ error: "bad_password", message: "That password is not right" });
    }
    reply.setCookie(COOKIE, makeToken(), { path: "/", httpOnly: true, sameSite: "lax", secure: config.PUBLIC_BASE_URL.startsWith("https"), maxAge: 30 * DAY });
    return { ok: true, authRequired: true };
  });
  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });
  app.get("/api/auth/me", async (req) => ({ authRequired: authEnabled(), signedIn: !authEnabled() || validToken(req.cookies?.[COOKIE]) }));
}
