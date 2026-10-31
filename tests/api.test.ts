// End-to-end over HTTP against a real Postgres (DATABASE_URL). Claude, image models and
// Instagram are not called: the test checks the plan/post/approval flow and the stubs.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import type { FastifyInstance } from "fastify";

process.env.APP_PASSWORD ??= "test-password-123";
process.env.MEDIA_DIR ??= "/tmp/post-studio-test-media";
process.env.PUBLIC_BASE_URL ??= "http://localhost:8080";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.IG_ACCESS_TOKEN;

const { buildServer } = await import("../src/server.js");
const { migrate } = await import("../src/db/migrate.js");
const { pool } = await import("../src/db/index.js");

let app: FastifyInstance;
let cookie = "";

beforeAll(async () => {
  await migrate();
  app = await buildServer();
  await app.ready();
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { password: process.env.APP_PASSWORD } });
  expect(login.statusCode).toBe(200);
  cookie = login.headers["set-cookie"]!.toString().split(";")[0];
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

const j = (r: { body: string }) => JSON.parse(r.body);

describe("auth", () => {
  it("rejects a wrong password and protects the API", async () => {
    const bad = await app.inject({ method: "POST", url: "/api/auth/login", payload: { password: "nope" } });
    expect(bad.statusCode).toBe(401);
    const noCookie = await app.inject({ method: "GET", url: "/api/plans" });
    expect(noCookie.statusCode).toBe(401);
  });
});

describe("status and stubs", () => {
  it("reports what is configured", async () => {
    const r = await app.inject({ method: "GET", url: "/api/status" });
    const s = j(r);
    expect(s.claude.configured).toBe(false);
    expect(s.instagram.publishEnabled).toBe(false);
    expect(Array.isArray(s.images)).toBe(true);
  });
  it("answers 503 for Claude when no key is set", async () => {
    const r = await app.inject({ method: "POST", url: "/api/ai/json", headers: { cookie }, payload: { prompt: "hi" } });
    expect(r.statusCode).toBe(503);
  });
});

describe("plan → post → approve → schedule", () => {
  let planId: string;
  let postId: string;
  let assetId: string;
  const week = "2031-01-06";

  it("creates and reads a plan", async () => {
    const r = await app.inject({ method: "PUT", url: "/api/plans", headers: { cookie }, payload: { weekStart: week, state: { postCount: 3 } } });
    expect(r.statusCode).toBe(200);
    planId = j(r).plan.id;
    const g = await app.inject({ method: "GET", url: `/api/plans/${week}`, headers: { cookie } });
    expect(j(g).plan.state.postCount).toBe(3);
  });

  it("uploads a rendered slide", async () => {
    const jpg = await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#121a33" } }).jpeg().toBuffer();
    const boundary = "----vitest";
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="1.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      jpg,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const r = await app.inject({ method: "POST", url: `/api/images/upload?planId=${planId}&kind=render`, headers: { cookie, "content-type": `multipart/form-data; boundary=${boundary}` }, payload: body });
    expect(r.statusCode).toBe(200);
    assetId = j(r).assets[0].id;
    const media = await app.inject({ method: "GET", url: new URL(j(r).assets[0].url).pathname });
    expect(media.statusCode).toBe(200);
  });

  it("blocks approval while facts are missing, then approves", async () => {
    const c = await app.inject({ method: "POST", url: `/api/plans/${planId}/posts`, headers: { cookie }, payload: { kind: "event", topic: "Event recap", scheduledFor: "2031-01-06T13:30:00+05:30", renderAssetIds: [assetId], caption: "We hosted [CONFIRM: name]" } });
    expect(c.statusCode).toBe(200);
    postId = j(c).post.id;
    const blocked = await app.inject({ method: "POST", url: `/api/posts/${postId}/approve`, headers: { cookie }, payload: { approve: true } });
    expect(blocked.statusCode).toBe(422);
    const upd = await app.inject({ method: "PUT", url: `/api/posts/${postId}`, headers: { cookie }, payload: { caption: "One evening, one room. Thank you all." } });
    expect(j(upd).post.state).toBe("draft");
    const ok = await app.inject({ method: "POST", url: `/api/posts/${postId}/approve`, headers: { cookie }, payload: { approve: true } });
    expect(j(ok).post.state).toBe("approved");
    expect(j(ok).post.approved_hash).toBeTruthy();
  });

  it("refuses to schedule while Instagram is not connected", async () => {
    const r = await app.inject({ method: "POST", url: `/api/posts/${postId}/schedule`, headers: { cookie }, payload: {} });
    expect(r.statusCode).toBe(503);
    expect(j(r).error).toBe("instagram_not_connected");
  });

  it("voids approval when the caption changes", async () => {
    const upd = await app.inject({ method: "PUT", url: `/api/posts/${postId}`, headers: { cookie }, payload: { caption: "Changed after approval" } });
    expect(j(upd).post.state).toBe("draft");
    expect(j(upd).post.approved_hash).toBeNull();
  });
});
