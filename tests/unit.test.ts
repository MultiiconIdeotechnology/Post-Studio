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
