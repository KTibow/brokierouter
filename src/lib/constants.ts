import BENCHMARKS_DATA from "./benchmarks.json" with { type: "json" };
import TOKEN_USAGE_DATA from "./token-usage.json" with { type: "json" };

export const BENCHMARKS: Record<
  string,
  Record<string, { tps: number; ttfb: number | null }>
> = BENCHMARKS_DATA;

// ─── groq tpm ─────────────────────────────────────────────────────────────

export const GROQ_TPM: Record<string, number> = {
  "allam-2-7b": 6_000,
  "groq/compound": 70_000,
  "groq/compound-mini": 70_000,
  "llama-3.1-8b-instant": 6_000,
  "llama-3.3-70b-versatile": 12_000,
  "meta-llama/llama-4-scout-17b-16e-instruct": 30_000,
  "openai/gpt-oss-120b": 8_000,
  "openai/gpt-oss-20b": 8_000,
  "qwen/qwen3-32b": 6_000,
};

// ─── vision sets ───────────────────────────────────────────────────────────

export const CROF_VISION = new Set([
  "kimi-k2.5",
  "kimi-k2.5-lightning",
  "gemma-4-31b-it",
  "qwen3.5-397b-a17b",
  "qwen3.5-9b",
  "qwen3.5-9b-chat",
]);

export const GROQ_VISION = new Set([
  "meta-llama/llama-4-scout-17b-16e-instruct",
]);

// ─── provider skip lists ───────────────────────────────────────────────────

export const GROQ_SKIP = new Set([
  "whisper-large-v3",
  "whisper-large-v3-turbo",
  "meta-llama/llama-prompt-guard-2-22m",
  "meta-llama/llama-prompt-guard-2-86m",
  "openai/gpt-oss-safeguard-20b",
  "canopylabs/orpheus-arabic-saudi",
  "canopylabs/orpheus-v1-english",
]);

// ─── hack club restrictions ────────────────────────────────────────────────
// Hack Club proxies OpenRouter with account-level restrictions we mirror here.

// Models that only route inside the US; Hack Club's proxy runs on Hetzner (DE)
export const HC_GEOBLOCKED = /^meta\/muse-spark/;

// Hack Club has banned these sub-providers outright
export const HC_BANNED_TAGS = new Set(["cerebras"]);

// Hack Club's account enforces ZDR on frontier model groups: every endpoint
// serving a model authored by these orgs must be on OpenRouter's ZDR list
// (https://openrouter.ai/api/v1/endpoints/zdr), regardless of which
// sub-provider hosts it.
export const HC_ZDR_ENFORCED_AUTHORS = new Set([
  "anthropic",
  "openai",
  "google",
  "x-ai",
]);

export const CEREBRAS_CONTEXT: Record<string, number> = {
  "gemma-4-31b": 30000,
  "gpt-oss-120b": 30000,
  "zai-glm-4.7": 30000,
};

// ─── provider id mappings ──────────────────────────────────────────────────

export const CROF_MAP: Record<string, { orId: string; variant?: string }> = {
  "deepseek-v4-pro": { orId: "deepseek/deepseek-v4-pro" },
  "deepseek-v4-pro-precision": {
    orId: "deepseek/deepseek-v4-pro",
    variant: "precision",
  },
  "deepseek-v4-pro-lightning": {
    orId: "deepseek/deepseek-v4-pro",
    variant: "lightning",
  },
  "mimo-v2.5-pro": { orId: "xiaomi/mimo-v2.5-pro" },
  "mimo-v2.5-pro-precision": {
    orId: "xiaomi/mimo-v2.5-pro",
    variant: "precision",
  },
  "deepseek-v4-flash": { orId: "deepseek/deepseek-v4-flash" },
  "kimi-k2.7-code": { orId: "moonshotai/kimi-k2.7-code" },
  "kimi-k2.6": { orId: "moonshotai/kimi-k2.6" },
  "kimi-k2.6-precision": { orId: "moonshotai/kimi-k2.6", variant: "precision" },
  "kimi-k2.5": { orId: "moonshotai/kimi-k2.5" },
  "kimi-k2.5-lightning": { orId: "moonshotai/kimi-k2.5", variant: "lightning" },
  "glm-5": { orId: "z-ai/glm-5" },
  "glm-5.1": { orId: "z-ai/glm-5.1" },
  "glm-5.1-precision": { orId: "z-ai/glm-5.1", variant: "precision" },
  "glm-5.2": { orId: "z-ai/glm-5.2" },
  "minimax-m2.5": { orId: "minimax/minimax-m2.5" },
  "qwen3.6-27b": { orId: "qwen/qwen3.6-27b" },
  "qwen3.5-397b-a17b": { orId: "qwen/qwen3.5-397b-a17b" },
  "qwen3.5-9b": { orId: "qwen/qwen3.5-9b" },
  "qwen3.5-9b-chat": { orId: "qwen/qwen3.5-9b", variant: "chat" },
  "glm-4.7": { orId: "z-ai/glm-4.7" },
  "glm-4.7-flash": { orId: "z-ai/glm-4.7-flash" },
  "deepseek-v3.2": { orId: "deepseek/deepseek-v3.2" },
  "gemma-4-31b-it": { orId: "google/gemma-4-31b-it" },
};

export const GROQ_ID_TO_OR: Record<string, string> = {
  "llama-3.1-8b-instant": "meta-llama/llama-3.1-8b-instruct",
  "llama-3.3-70b-versatile": "meta-llama/llama-3.3-70b-instruct",
  "meta-llama/llama-4-scout-17b-16e-instruct": "meta-llama/llama-4-scout",
  "openai/gpt-oss-120b": "openai/gpt-oss-120b",
  "openai/gpt-oss-20b": "openai/gpt-oss-20b",
  "qwen/qwen3.6-27b": "qwen/qwen3.6-27b",
  "qwen/qwen3-32b": "qwen/qwen3-32b",
  "allam-2-7b": "humain-ai/allam-2-7b",
};

export const CEREBRAS_ID_TO_OR: Record<string, string> = {
  "zai-glm-4.7": "z-ai/glm-4.7",
  "gpt-oss-120b": "openai/gpt-oss-120b",
  "gemma-4-31b": "google/gemma-4-31b-it",
};

export const GOOGLE_NAME_TO_OR: Record<string, string> = {
  "models/gemini-2.5-flash": "google/gemini-2.5-flash",
  "models/gemma-3-1b-it": "google/gemma-3-1b-it",
  "models/gemma-3-4b-it": "google/gemma-3-4b-it",
  "models/gemma-3-12b-it": "google/gemma-3-12b-it",
  "models/gemma-3-27b-it": "google/gemma-3-27b-it",
  "models/gemma-3n-e4b-it": "google/gemma-3n-e4b-it",
  "models/gemma-3n-e2b-it": "google/gemma-3n-e2b-it",
  "models/gemma-4-26b-a4b-it": "google/gemma-4-26b-a4b-it",
  "models/gemma-4-31b-it": "google/gemma-4-31b-it",
  "models/gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
  "models/gemini-3-flash-preview": "google/gemini-3-flash-preview",
  "models/gemini-3.1-flash-lite": "google/gemini-3.1-flash-lite",
  "models/gemini-3.5-flash": "google/gemini-3.5-flash",
};

// ─── model skip lists ─────────────────────────────────────────────────────

// Dated checkpoints that are redundant
export const MODEL_SKIP = new Set([
  "openai/gpt-4o-2024-08-06",
  "openai/gpt-4o-mini-2024-07-18",
  "openai/o1-preview",
  "google/gemini-3.1-flash-lite-preview",
]);

// Fast-tier models that are the same model at a different service tier.
// Key = fast model ID, value = base model ID to merge into.
export const FAST_MODEL_MAP: Record<string, string> = {
  "anthropic/claude-opus-4.6-fast": "anthropic/claude-opus-4.6",
  "anthropic/claude-opus-4.7-fast": "anthropic/claude-opus-4.7",
  "anthropic/claude-opus-4.8-fast": "anthropic/claude-opus-4.8",
};

// ─── token use proxies ─────────────────────────────────────────────────────

const tokenProxy = (totalTokens: number) => Math.round(totalTokens / 50000);
const TOKEN_USAGE = TOKEN_USAGE_DATA as Record<
  string,
  { direct?: number; thinking?: number }
>;

export const TOKEN_USE_PROXIES: Record<
  string,
  { direct?: number; thinking?: number }
> = Object.fromEntries(
  Object.entries(TOKEN_USAGE).map(([id, usage]) => [
    id,
    {
      ...(usage.direct !== undefined
        ? { direct: tokenProxy(usage.direct) }
        : {}),
      ...(usage.thinking !== undefined
        ? { thinking: tokenProxy(usage.thinking) }
        : {}),
    },
  ]),
);
