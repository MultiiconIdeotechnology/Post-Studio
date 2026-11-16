import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { extractJson } from "../src/ai/claude.js";
import { composePost, overlaySvg } from "../src/images/compose.js";
import { loadConfig } from "../src/config.js";
import { makeToken, validToken } from "../src/auth.js";

describe("extractJson", () => {
  it("reads plain, fenced and embedded JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Here:\n```json\n[1,2]\n```')).toEqual([1, 2]);
    expect(extractJson('Sure. {"options":[{"x":"y"}]} Done.')).toEqual({ options: [{ x: "y" }] });
  });
  it("rejects text without JSON", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("config", () => {
  it("applies defaults and reads the publish switch", () => {
    const c = loadConfig({ IG_PUBLISH_ENABLED: "true" } as NodeJS.ProcessEnv);
    expect(c.PORT).toBe(8080);
    expect(c.CLAUDE_MODEL).toBe("claude-opus-5-5");
    expect(c.IG_PUBLISH_ENABLED).toBe(true);
  });
});

describe("auth tokens", () => {
  it("round-trips and rejects tampering", () => {
    const t = makeToken();
    expect(validToken(t)).toBe(true);
    expect(validToken(t.slice(0, -2) + "xx")).toBe(false);
    expect(validToken(undefined)).toBe(false);
  });
});

describe("compose", () => {
  it("escapes text in the overlay and produces a 1080x1350 JPEG", async () => {
    const svg = overlaySvg("4:5", { headline: 'Tom & Jerry <3 "quotes"' });
    expect(svg).toContain("&amp;");
    expect(svg).not.toContain("<3");
    const base = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#224" } }).jpeg().toBuffer();
    const out = await composePost(base, "4:5", { kicker: "Last week", headline: "One evening. One room.", body: "Partners and customers together.", pageLabel: "1 / 3" });
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1350);
  });
});

describe("gemini errors", async () => {
  const { explainGeminiError } = await import("../src/images/gemini.js");
  it("explains a free-tier quota of zero as a billing problem", () => {
    const e = Object.assign(new Error("Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0"), { status: 429 });
    expect(explainGeminiError(e).message).toMatch(/billing/);
  });
  it("explains a bad key", () => {
    expect(explainGeminiError(Object.assign(new Error("API key not valid"), { status: 400 })).message).toMatch(/GEMINI_API_KEY/);
  });
});

describe("higgsfield errors", async () => {
  const { explainHiggsfieldError } = await import("../src/images/higgsfield.js");
  it("points to the keys on 401 and to the balance on 402", () => {
    expect(explainHiggsfieldError(401, '{"detail":"Invalid credentials"}').message).toMatch(/HIGGSFIELD_KEY_ID/);
    expect(explainHiggsfieldError(402, "").message).toMatch(/Top up/);
  });
});

describe("claude design svg", async () => {
  const { sanitizeSvg, renderSvg } = await import("../src/images/claude-design.js");
  it("removes scripts, text, external links and images", () => {
    const out = sanitizeSvg(`Here you go:\n<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="x()"><script>x()</script><image href="file:///etc/passwd"/><text>Hi</text><use href="#a"/><rect fill="url(https://evil/x)"/><rect fill="url(#g)"/></svg> done`);
    expect(out.startsWith("<svg")).toBe(true);
    expect(out).not.toMatch(/script|onload|<image|<text|evil|passwd/);
    expect(out).toContain('href="#a"');
    expect(out).toContain("url(#g)");
  });
  it("rejects a reply with no svg", () => {
    expect(() => sanitizeSvg("sorry")).toThrow();
  });
  it("renders to the requested size", async () => {
    const png = await renderSvg('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="125"><rect width="100" height="125" fill="#121a33"/></svg>', 1080, 1350);
    const m = await sharp(png).metadata();
    expect([m.width, m.height]).toEqual([1080, 1350]);
  });
});
