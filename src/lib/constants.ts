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

export const CEREBRAS_SKIP = new Set(["zai-glm-4.7", "gpt-oss-120b"]);

export const CEREBRAS_CONTEXT: Record<string, number> = {
  "gemma-4-31b": 30000,
  "gpt-oss-120b": 30000,
  "zai-glm-4.7": 30000,
};

export const GHM_SKIP = new Set(["openai/o1-mini"]);

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

export const GHM_ID_TO_OR: Record<string, string> = {
  "cohere/cohere-command-a": "cohere/command-a",
  "cohere/cohere-command-r-08-2024": "cohere/command-r-08-2024",
  "cohere/cohere-command-r-plus-08-2024": "cohere/command-r-plus-08-2024",
  "deepseek/deepseek-v3-0324": "deepseek/deepseek-chat-v3-0324",
  "meta/llama-3.2-11b-vision-instruct":
    "meta-llama/llama-3.2-11b-vision-instruct",
  "meta/llama-3.2-90b-vision-instruct":
    "meta-llama/llama-3.2-90b-vision-instruct",
  "meta/llama-3.3-70b-instruct": "meta-llama/llama-3.3-70b-instruct",
  "meta/meta-llama-3.1-405b-instruct": "meta-llama/llama-3.1-405b-instruct",
  "meta/llama-4-maverick-17b-128e-instruct-fp8": "meta-llama/llama-4-maverick",
  "meta/llama-4-scout-17b-16e-instruct": "meta-llama/llama-4-scout",
  "meta/meta-llama-3.1-8b-instruct": "meta-llama/llama-3.1-8b-instruct",
  "mistral-ai/ministral-3b": "mistralai/ministral-3b",
  "mistral-ai/mistral-medium-2505": "mistralai/mistral-medium-3",
  "mistral-ai/mistral-small-2503": "mistralai/mistral-small-3.1-24b-instruct",
  "xai/grok-3": "x-ai/grok-3",
  "xai/grok-3-mini": "x-ai/grok-3-mini",
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
  "llama-3.3-70b": "meta-llama/llama-3.3-70b-instruct",
  "llama3.1-8b": "meta-llama/llama-3.1-8b-instruct",
  "zai-glm-4.7": "z-ai/glm-4.7",
  "gpt-oss-120b": "openai/gpt-oss-120b",
  "qwen-3-235b-a22b-instruct-2507": "qwen/qwen3-235b-a22b-2507",
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

export const GHC_ID_TO_OR: Record<string, string> = {
  "gemini-3.1-pro-preview": "google/gemini-3.1-pro-preview",
  "gpt-5.2-codex": "openai/gpt-5.2-codex",
  "gpt-5.3-codex": "openai/gpt-5.3-codex",
  "gpt-5.4-mini": "openai/gpt-5.4-mini",
  "gpt-5-mini": "openai/gpt-5-mini",
  "grok-code-fast-1": "x-ai/grok-code-fast-1",
  "claude-haiku-4.5": "anthropic/claude-haiku-4.5",
  "gemini-3-flash-preview": "google/gemini-3-flash-preview",
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "oswe-vscode-prime": "openai/raptor-mini",
  "gpt-5.2": "openai/gpt-5.2",
  "gpt-4.1": "openai/gpt-4.1",
  "gpt-4o": "openai/gpt-4o",
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

// ─── reasoning efforts ─────────────────────────────────────────────────────

type Effort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

const MODEL_EFFORTS: Record<string, (Effort | null)[]> = {
  // ANTHROPIC ─────────────────────────────────────────────
  // Effort API added progressively. Supported on: Opus 4.5, Sonnet 4.6, Opus 4.6, Opus 4.7
  // Older models use budget_tokens (on/off toggle) → "none" | "medium" standin
  // xhigh: Opus 4.7 only. max: Opus 4.6+, Sonnet 4.6.
  "anthropic/claude-3-haiku": [null],
  "anthropic/claude-3.5-haiku": [null],
  "anthropic/claude-haiku-4.5": [null],
  "anthropic/claude-3.7-sonnet": ["none", "medium"], // budget_tokens on/off
  "anthropic/claude-sonnet-4": ["none", "medium"], // budget_tokens on/off
  "anthropic/claude-sonnet-4.5": ["none", "medium"], // budget_tokens on/off
  "anthropic/claude-sonnet-4.6": ["none", "low", "medium", "high", "max"],
  "anthropic/claude-opus-4": ["none", "medium"], // budget_tokens on/off
  "anthropic/claude-opus-4.1": ["none", "medium"], // budget_tokens on/off
  "anthropic/claude-opus-4.5": ["none", "low", "medium", "high"], // effort API, no max
  "anthropic/claude-opus-4.6": ["none", "low", "medium", "high", "max"],
  "anthropic/claude-opus-4.6-fast": ["none", "low", "medium", "high", "max"],
  "anthropic/claude-opus-4.7": [
    "none",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
  ],

  // OPENAI ─────────────────────────────────────────────────
  // GPT-4o / 4.1 family: no reasoning
  "openai/gpt-4o": [null],
  "openai/gpt-4o-2024-05-13": [null],
  "openai/gpt-4o-2024-11-20": [null],
  "openai/gpt-4o-audio-preview": [null],
  "openai/gpt-4o-mini": [null],
  "openai/gpt-4o-mini-search-preview": [null],
  "openai/gpt-4o-search-preview": [null],
  "openai/gpt-4.1": [null],
  "openai/gpt-4.1-mini": [null],
  "openai/gpt-4.1-nano": [null],
  // o-series: low/medium/high only (no xhigh, no none)
  "openai/o1": ["low", "medium", "high"],
  "openai/o1-mini": ["low", "medium", "high"],
  "openai/o1-pro": ["low", "medium", "high"],
  "openai/o3-mini": ["low", "medium", "high"],
  "openai/o3": ["low", "medium", "high"],
  "openai/o3-pro": ["low", "medium", "high"],
  "openai/o3-deep-research": ["medium"], // always-on deep research
  "openai/o4-mini": ["low", "medium", "high"],
  "openai/o4-mini-deep-research": ["medium"], // always-on
  "openai/gpt-oss-20b": ["low", "medium", "high"],
  "openai/gpt-oss-120b": ["low", "medium", "high"],
  // GPT-5 (original): minimal/low/medium/high — no "none", no xhigh
  "openai/gpt-5": ["minimal", "low", "medium", "high"],
  "openai/gpt-5-image": ["minimal", "low", "medium", "high"],
  "openai/gpt-5-mini": ["minimal", "low", "medium", "high"],
  "openai/gpt-5-image-mini": ["minimal", "low", "medium", "high"],
  "openai/raptor-mini": ["minimal", "low", "medium", "high"],
  "openai/gpt-5-nano": ["minimal", "low", "medium", "high"],
  "openai/gpt-5-chat": [null], // chat/non-reasoning variant
  "openai/gpt-5-codex": ["low", "medium", "high"], // no minimal, no xhigh
  "openai/gpt-5-pro": ["high"], // fixed at high only
  // GPT-5.1: none added as default; codex-max first to get xhigh
  "openai/gpt-5.1": ["none", "low", "medium", "high"],
  "openai/gpt-5.1-chat": [null],
  "openai/gpt-5.1-codex": ["low", "medium", "high"],
  "openai/gpt-5.1-codex-mini": ["low", "medium", "high"],
  "openai/gpt-5.1-codex-max": ["low", "medium", "high", "xhigh"], // xhigh debut
  // GPT-5.2: xhigh added across the board
  "openai/gpt-5.2": ["none", "low", "medium", "high", "xhigh"],
  "openai/gpt-5.2-chat": [null],
  "openai/gpt-5.2-codex": ["low", "medium", "high", "xhigh"],
  "openai/gpt-5.2-pro": ["high", "xhigh"], // pro = always reasoning, wide range
  // GPT-5.3
  "openai/gpt-5.3-chat": [null],
  "openai/gpt-5.3-codex": ["low", "medium", "high", "xhigh"],
  // GPT-5.4: full range none→xhigh; mini/nano also reach xhigh (confirmed in release chart)
  "openai/gpt-5.4": ["none", "low", "medium", "high", "xhigh"],
  "openai/gpt-5.4-mini": ["none", "low", "medium", "high", "xhigh"],
  "openai/gpt-5.4-nano": ["none", "low", "medium", "high", "xhigh"],
  "openai/gpt-5.4-pro": ["low", "medium", "high", "xhigh"],
  "openai/gpt-5.5": ["none", "low", "medium", "high", "xhigh"],
  "openai/gpt-5.5-pro": ["low", "medium", "high", "xhigh"],

  // GOOGLE ─────────────────────────────────────────────────
  "google/gemini-2.0-flash-001": ["minimal"],
  "google/gemini-2.0-flash-lite-001": ["minimal"],
  "google/gemini-2.5-pro": ["low", "medium", "high"],
  "google/gemini-2.5-flash": ["minimal", "low", "medium", "high"],
  "google/gemini-2.5-flash-lite": ["minimal", "low", "medium", "high"],
  "google/gemini-2.5-flash-lite-preview-09-2025": [
    "minimal",
    "low",
    "medium",
    "high",
  ],
  "google/gemini-2.5-flash-image": ["minimal"],
  "google/gemini-3-flash-preview": ["minimal", "low", "medium", "high"],
  "google/gemini-3-pro-image-preview": ["minimal", "low", "medium", "high"],
  "google/gemini-3.1-pro-preview": ["low", "medium", "high"],
  "google/gemini-3.1-pro-preview-customtools": ["low", "medium", "high"],
  "google/gemini-3.1-flash-lite": ["minimal", "low", "medium", "high"],
  "google/gemini-3.5-flash": ["minimal", "low", "medium", "high"],

  // XAI ─────────────────────────────────────────────────────
  "x-ai/grok-3": [null], // no reasoning
  "x-ai/grok-3-mini": ["medium", "high"],
  "x-ai/grok-4.1-fast": ["none", "medium", "high"],
  "x-ai/grok-code-fast-1": [null], // no reasoning
  "x-ai/grok-4.20-multi-agent": ["medium", "high"],
  "x-ai/grok-4.3": ["none", "low", "medium", "high"],

  // OTHERS
  "deepseek/deepseek-r1": ["medium"],
  "deepseek/deepseek-r1-0528": ["medium"],
  "deepseek/deepseek-r1-distill-llama-70b": ["medium"],
  "deepseek/deepseek-r1-distill-qwen-32b": ["medium"],
  "deepseek/deepseek-v3.2-speciale": ["medium"],
  "tngtech/deepseek-r1t2-chimera": ["medium"],
  "qwen/qwen3-32b": ["none", "medium"],
  "google/gemma-4-26b-a4b-it": ["none", "medium"],
  "google/gemma-4-31b-it": ["none", "medium"],
};

// ─── per-provider reasoning effort restrictions ───────────────────────────
// Some providers don't support all effort levels for a given model.
// Key = model ID, value = map of provider ID prefix → allowed efforts.

export const REASONING_EFFORT_OVERRIDES: Record<
  string,
  Record<string, (Effort | "default")[]>
> = {
  "z-ai/glm-4.7": {
    "openrouter/google-vertex": ["medium"],
    "hack-club/google-vertex": ["medium"],
  },
  "qwen/qwen3-32b": {
    "groq-free": ["none", "default"],
  },
  "google/gemma-4-26b-a4b-it": {
    "google-free": ["minimal", "high"],
  },
  "google/gemma-4-31b-it": {
    "google-free": ["minimal", "high"],
  },
  "google/gemini-3-flash-preview": {
    "github-copilot": ["low", "medium", "high"],
  },
};

// Providers whose APIs reject the reasoning_effort parameter entirely for
// non-reasoning models. When a model on one of these providers gets the
// default ["none"] (meaning it doesn't reason), we send [null] instead so
// the parameter is omitted from the request.
export const PICKY_PROVIDERS = new Set([
  "groq-free",
  "cerebras-free",
  "google-free",
  "github-models",
]);

const THINKING_KEYWORDS = ["r1", "reasoning", "think", "deepthink"];

export const getReasoningEfforts = (
  modelId: string,
  providerId?: string,
  supportsReasoningParam?: boolean,
  crofId?: string,
) => {
  // Crof: all models have always-on reasoning, except -chat variants
  if (providerId === "crofai" && crofId) {
    return crofId.includes("-chat") ? ["none" as const] : ["medium" as const];
  }
  if (MODEL_EFFORTS[modelId]) return [...MODEL_EFFORTS[modelId]];
  for (const prefix of Object.keys(MODEL_EFFORTS)) {
    if (modelId.startsWith(prefix)) console.warn("No effort for", modelId);
  }
  if (modelId.includes("-thinking")) return ["medium" as const];
  if (supportsReasoningParam) return ["none" as const, "medium" as const];
  const lower = modelId.toLowerCase();
  if (THINKING_KEYWORDS.some((k) => lower.includes(k)))
    return ["none" as const, "medium" as const];
  if (providerId && PICKY_PROVIDERS.has(providerId)) return [null];
  return ["none" as const];
};
