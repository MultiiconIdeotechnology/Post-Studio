import { z } from "zod";

// Every setting comes from the environment so the same image runs anywhere.
// Missing optional keys switch a feature off; the UI reads /api/status to know what is on.
const Env = z.object({
  NODE_ENV: z.string().default("production"),
  PORT: z.coerce.number().default(8080),
  HOST: z.string().default("0.0.0.0"),
  PUBLIC_BASE_URL: z.string().default("http://localhost:8080"),
  APP_PASSWORD: z.string().min(8).optional(),
  SESSION_SECRET: z.string().min(16).optional(),
  DATABASE_URL: z.string().default("postgres://poststudio:poststudio@db:5432/poststudio"),
  MEDIA_DIR: z.string().default("/data/media"),
  TIMEZONE: z.string().default("Asia/Kolkata"),

  ANTHROPIC_API_KEY: z.string().optional(),
  CLAUDE_MODEL: z.string().default("claude-opus-5-5"),
  CLAUDE_MODEL_QUICK: z.string().default("claude-opus-5-5"),
  CLAUDE_MAX_TOKENS: z.coerce.number().default(16000),

  FAL_KEY: z.string().optional(),
  FAL_FLUX_MODEL: z.string().default("fal-ai/flux-pro/v1.1-ultra"),
  FAL_FLUX_EDIT_MODEL: z.string().default("fal-ai/flux-pro/kontext"),
  FAL_IDEOGRAM_MODEL: z.string().default("fal-ai/ideogram/v3"),
  FAL_KLING_IMAGE_MODEL: z.string().default("fal-ai/kling-image/v2"),
  GEMINI_API_KEY: z.string().optional(),
  // Nano Banana 2. Use gemini-3-pro-image for slides with a lot of text (about 2x the price).
  GEMINI_IMAGE_MODEL: z.string().default("gemini-3.1-flash-image"),
  GEMINI_IMAGE_SIZE: z.enum(["1K", "2K"]).default("2K"),
  // Higgsfield API (separate prepaid balance, not the website plan). Key from console.higgsfield.ai.
  HIGGSFIELD_KEY_ID: z.string().optional(),
  HIGGSFIELD_KEY_SECRET: z.string().optional(),
  HIGGSFIELD_IMAGE_MODEL: z.string().default("higgsfield-ai/soul/v2/standard"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-1"),
  // Empty means "the first provider that has a key".
  DEFAULT_IMAGE_PROVIDER: z.string().optional(),

  IG_USER_ID: z.string().optional(),
  IG_ACCESS_TOKEN: z.string().optional(),
  IG_GRAPH_VERSION: z.string().default("v25.0"),
  IG_PUBLISH_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  return parsed.data;
}

export const config = loadConfig();
