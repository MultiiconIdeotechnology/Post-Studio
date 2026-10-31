import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { query } from "../db/index.js";

// One thin service around the Claude API. Prompts stay in the callers; this handles
// model choice, images, JSON extraction, usage logging and refusal handling.

export type Tier = "quick" | "default" | "complex";

export interface SampleInput {
  prompt: string;
  system?: string;
  images?: { data: Buffer; mime: "image/jpeg" | "image/png" | "image/webp" }[];
  tier?: Tier;
  task?: string;
  maxTokens?: number;
}

export class ClaudeError extends Error {
  constructor(
    public code: "not_configured" | "refusal" | "rate_limited" | "invalid_json" | "api_error" | "truncated",
    message: string,
    public text?: string,
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!config.ANTHROPIC_API_KEY) throw new ClaudeError("not_configured", "ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
  return client;
}

export function claudeConfigured(): boolean {
  return !!config.ANTHROPIC_API_KEY;
}

export function modelFor(tier: Tier = "default"): string {
  return tier === "quick" ? config.CLAUDE_MODEL_QUICK : config.CLAUDE_MODEL;
}

async function logCall(task: string, model: string, started: number, usage: Anthropic.Usage | null, error?: string) {
  await query(
    `insert into llm_call (task, model, input_tokens, output_tokens, cache_read_tokens, latency_ms, ok, error)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      task,
      model,
      usage?.input_tokens ?? null,
      usage?.output_tokens ?? null,
      usage?.cache_read_input_tokens ?? null,
      Date.now() - started,
      !error,
      error ?? null,
    ],
  ).catch(() => undefined);
}

export async function sampleText(input: SampleInput): Promise<string> {
  const anthropic = getClient();
  const model = modelFor(input.tier);
  const started = Date.now();
  const content: Anthropic.ContentBlockParam[] = [];
  for (const img of input.images ?? []) {
    content.push({ type: "image", source: { type: "base64", media_type: img.mime, data: img.data.toString("base64") } });
  }
  content.push({ type: "text", text: input.prompt });
  try {
    const res = await anthropic.messages.create({
      model,
      max_tokens: input.maxTokens ?? config.CLAUDE_MAX_TOKENS,
      system: input.system,
      // Opus 5.5 defaults to medium effort; the creative work here deserves high.
      output_config: { effort: input.tier === "quick" ? "low" : "high" },
      messages: [{ role: "user", content }],
    });
    await logCall(input.task ?? "sample", model, started, res.usage);
    if (res.stop_reason === "refusal") {
      throw new ClaudeError("refusal", res.stop_details?.explanation ?? "Claude declined this request");
    }
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (res.stop_reason === "max_tokens") throw new ClaudeError("truncated", "Answer was cut short", text);
    return text;
  } catch (e) {
    if (e instanceof ClaudeError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    await logCall(input.task ?? "sample", model, started, null, msg);
    if (e instanceof Anthropic.RateLimitError) throw new ClaudeError("rate_limited", msg);
    throw new ClaudeError("api_error", msg);
  }
}

// Tolerant JSON read: whole text, else a fenced block, else first { or [ to last } or ].
export function extractJson<T = unknown>(text: string): T {
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return undefined;
    }
  };
  const direct = tryParse(text.trim());
  if (direct !== undefined) return direct;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    const v = tryParse(fence[1].trim());
    if (v !== undefined) return v;
  }
  const first = Math.min(...["{", "["].map((c) => text.indexOf(c)).filter((i) => i >= 0));
  const last = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (isFinite(first) && last > first) {
    const v = tryParse(text.slice(first, last + 1));
    if (v !== undefined) return v;
  }
  throw new ClaudeError("invalid_json", "Claude's reply was not valid JSON", text);
}

export async function sampleJson<T = unknown>(input: SampleInput): Promise<T> {
  const text = await sampleText({
    ...input,
    system: [input.system, "Reply with only the JSON that was asked for. No prose before or after it."].filter(Boolean).join("\n\n"),
  });
  return extractJson<T>(text);
}
