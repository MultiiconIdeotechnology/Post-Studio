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

describe("anthropic errors", async () => {
  const { explainAnthropicError } = await import("../src/ai/claude.js");
  const apiErr = (status: number, message: string, type = "invalid_request_error") => Object.assign(new Error(message), { status, error: { error: { type, message } } });
  it("keeps Anthropic's own reason and classifies it", async () => {
    const bill = explainAnthropicError(apiErr(400, "Your credit balance is too low to access the Anthropic API."), "m");
    expect(bill.code).toBe("billing");
    expect(bill.message).toMatch(/credit balance is too low/);
    expect(explainAnthropicError(apiErr(401, "invalid x-api-key", "authentication_error"), "m").code).toBe("auth");
    expect(explainAnthropicError(apiErr(404, "model: claude-x", "not_found_error"), "claude-x").code).toBe("model");
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    expect(explainAnthropicError(new Anthropic.APIConnectionError({ message: "fetch failed" }), "m").message).toMatch(/Could not reach/);
    expect(explainAnthropicError(new Error("Streaming is required"), "m").message).toMatch(/The Claude call failed/);
  });
});

describe("anthropic workspace error", async () => {
  const { explainAnthropicError } = await import("../src/ai/claude.js");
  it("explains an organisation-scoped key", () => {
    const e = Object.assign(new Error("x"), { status: 400, error: { error: { type: "invalid_request_error", message: "This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header" } } });
    expect(explainAnthropicError(e, "m").message).toMatch(/ANTHROPIC_WORKSPACE_ID/);
  });
});

describe("post design checks", async () => {
  const { checkWords, checkTextBounds, svgWords } = await import("../src/design/post-design.js");
  const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350">${body}</svg>`;
  const slide = { kicker: "AI security", headline: "Your AI tools need a check too", body: "Three things to review." };
  it("accepts the slide's own words, in any case", () => {
    const s = svg(`<text x="80" y="200" font-family="Inter" font-size="60"><tspan x="80" dy="0">YOUR AI TOOLS</tspan><tspan x="80" dy="70">need a check too</tspan></text><text x="80" y="400">Three things to review.</text><text x="80" y="120">AI SECURITY</text>`);
    expect(svgWords(s)).toContain("tools");
    expect(checkWords(s, slide, 0, 3)).toBeNull();
  });
  it("rejects invented words", () => {
    const s = svg(`<text x="80" y="200">Your AI tools need a check too. 99% of firms got hacked</text><text x="80" y="400">Three things to review.</text>`);
    expect(checkWords(s, slide, 0, 3)).toMatch(/hacked/);
  });
  it("rejects dropped words", () => {
    const s = svg(`<text x="80" y="200">Your AI tools</text>`);
    expect(checkWords(s, slide, 0, 3)).toMatch(/missing/);
  });
  it("finds text that runs off the canvas or into the wordmark band", async () => {
    expect(await checkTextBounds(svg(`<text x="80" y="300" font-family="Inter" font-size="60">Fits fine</text>`))).toBeNull();
    expect(await checkTextBounds(svg(`<text x="600" y="300" font-family="Inter" font-size="90">This line is far too long</text>`))).toMatch(/right margin/);
    expect(await checkTextBounds(svg(`<text x="80" y="1300" font-family="Inter" font-size="60">Too low</text>`))).toMatch(/bottom band/);
  });
});
