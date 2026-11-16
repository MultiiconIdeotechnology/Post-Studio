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
  // Overrides the tier's effort (quick = low, otherwise high).
  effort?: "low" | "medium" | "high";
}

export class ClaudeError extends Error {
  constructor(
    public code: "not_configured" | "refusal" | "rate_limited" | "invalid_json" | "api_error" | "truncated" | "auth" | "billing" | "model" | "overloaded",
    message: string,
    public text?: string,
  ) {
    super(message);
  }
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!config.ANTHROPIC_API_KEY) throw new ClaudeError("not_configured", "ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic({
    apiKey: config.ANTHROPIC_API_KEY,
    defaultHeaders: config.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": config.ANTHROPIC_WORKSPACE_ID } : undefined,
  });
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
    // Streaming: the SDK refuses non-streaming calls whose max_tokens could run past 10 minutes.
    const res = await anthropic.messages.stream({
      model,
      max_tokens: input.maxTokens ?? config.CLAUDE_MAX_TOKENS,
      system: input.system,
      // Opus 5.5 defaults to medium effort; the creative work here deserves high.
      output_config: { effort: input.effort ?? (input.tier === "quick" ? "low" : "high") },
      messages: [{ role: "user", content }],
    }).finalMessage();
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
    const err = explainAnthropicError(e, model);
    await logCall(input.task ?? "sample", model, started, null, err.message);
    // Server log only: the reason from Anthropic, never the key.
    console.error(`[claude] ${input.task ?? "sample"} failed: ${err.code}: ${err.message}`);
    throw err;
  }
}

// Turn an Anthropic SDK error into one line a person can act on, keeping Anthropic's own reason.
export function explainAnthropicError(e: unknown, model: string): ClaudeError {
  const status = (e as { status?: number }).status;
  const body = (e as { error?: { error?: { message?: string; type?: string } } }).error?.error;
  const upstream = body?.message ?? (e instanceof Error ? e.message : String(e));
  const reason = `Anthropic says: ${upstream}${status ? ` (HTTP ${status})` : ""}`;
  if (/anthropic-workspace-id|not scoped to a workspace/i.test(upstream)) {
    return new ClaudeError("auth", "This Anthropic key belongs to the whole organisation, not one workspace. Either create a key inside a workspace in the Claude Console and put it in ANTHROPIC_API_KEY, or add ANTHROPIC_WORKSPACE_ID=<workspace id> to .env, then restart. " + reason);
  }
  if (status === 401) return new ClaudeError("auth", `The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env. ${reason}`);
  if (status === 403) return new ClaudeError("auth", `This API key is not allowed to make this call. ${reason}`);
  if (/credit balance|billing|purchase credits/i.test(upstream)) return new ClaudeError("billing", `The Anthropic account has no usable credit. Check Plans & Billing in the Claude Console. ${reason}`);
  if (status === 404 || /model/i.test(body?.type ?? "") || /model:/i.test(upstream)) return new ClaudeError("model", `Model "${model}" is not available to this key. ${reason}`);
  if (status === 429) return new ClaudeError("rate_limited", `Rate limit reached. Wait a minute and try again. ${reason}`);
  if (status === 529 || /overloaded/i.test(upstream)) return new ClaudeError("overloaded", `Claude is busy right now. Try again in a minute. ${reason}`);
  if (e instanceof Anthropic.APIConnectionError) return new ClaudeError("api_error", `Could not reach the Anthropic API from the server. ${reason}`);
  if (!status) return new ClaudeError("api_error", `The Claude call failed. ${reason}`);
  return new ClaudeError("api_error", reason);
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
