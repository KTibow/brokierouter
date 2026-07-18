import type { ORModel } from "../types.ts";

export type Effort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"
  | "max";

const EFFORT_ORDER: Effort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

const isEffort = (e: string): e is Effort =>
  (EFFORT_ORDER as string[]).includes(e);

// ─── OpenRouter-family (openrouter, openrouter-free, hack-club) ───────────
// Efforts come straight from OR's native `reasoning` metadata, with two
// corrections:
//  1. OR omits "none" from supported_efforts on many models where
//     mandatory=false (Anthropic, Gemini Flash, Nemotron, ...) even though
//     reasoning can be disabled. mandatory=false → "none" is available.
//  2. Models OR wrongly marks as optional-reasoning; they always reason.

const FORCED_REASONERS = new Set(["openai/gpt-5.3-codex"]);

export const orReasoningEfforts = (m: ORModel): (Effort | null)[] => {
  const r = m.reasoning;
  if (!r) return [null]; // no reasoning support: omit the parameter

  const id = m.id.replace(":free", "");
  const mandatory = r.mandatory || FORCED_REASONERS.has(id);

  const efforts = new Set((r.supported_efforts ?? []).filter(isEffort));
  for (const e of r.supported_efforts ?? [])
    if (!isEffort(e)) console.warn(`Unknown effort "${e}" on ${m.id}`);

  // Reasoning without effort control: an on(/off) toggle
  if (!efforts.size)
    return mandatory ? ["medium"] : ["none", "medium"];

  if (mandatory) efforts.delete("none");
  else efforts.add("none");
  return EFFORT_ORDER.filter((e) => efforts.has(e));
};

// ─── CrofAI ───────────────────────────────────────────────────────────────
// All models have always-on reasoning, except -chat variants

export const crofReasoningEfforts = (crofId: string): Effort[] =>
  crofId.includes("-chat") ? ["none"] : ["medium"];

// ─── other non-OpenRouter providers (groq, cerebras, google) ──────────────
// These APIs don't advertise reasoning support, so efforts stay curated
// per model.

const MODEL_EFFORTS: Record<string, (Effort | null)[]> = {
  "openai/gpt-oss-20b": ["low", "medium", "high"],
  "openai/gpt-oss-120b": ["low", "medium", "high"],
  "qwen/qwen3-32b": ["none", "medium"],
  "google/gemma-4-26b-a4b-it": ["none", "medium"],
  "google/gemma-4-31b-it": ["none", "medium"],
  "google/gemini-2.5-flash": ["minimal", "low", "medium", "high"],
  "google/gemini-2.5-flash-lite": ["minimal", "low", "medium", "high"],
  "google/gemini-3-flash-preview": ["minimal", "low", "medium", "high"],
  "google/gemini-3.1-flash-lite": ["minimal", "low", "medium", "high"],
  "google/gemini-3.5-flash": ["minimal", "low", "medium", "high"],
};

// Providers whose APIs reject the reasoning_effort parameter entirely for
// non-reasoning models: send [null] so the parameter is omitted.
const PICKY_PROVIDERS = new Set(["groq-free", "cerebras-free", "google-free"]);

const THINKING_KEYWORDS = ["r1", "reasoning", "think", "deepthink"];

export const getReasoningEfforts = (
  modelId: string,
  providerId: string,
): (Effort | null)[] => {
  if (MODEL_EFFORTS[modelId]) return [...MODEL_EFFORTS[modelId]];
  for (const prefix of Object.keys(MODEL_EFFORTS)) {
    if (modelId.startsWith(prefix)) console.warn("No effort for", modelId);
  }
  if (modelId.includes("-thinking")) return ["medium"];
  const lower = modelId.toLowerCase();
  if (THINKING_KEYWORDS.some((k) => lower.includes(k)))
    return ["none", "medium"];
  if (PICKY_PROVIDERS.has(providerId)) return [null];
  return ["none"];
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
};
