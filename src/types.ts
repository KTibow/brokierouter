import {
  type InferOutput,
  object,
  string,
  number,
  boolean,
  array,
  nullable,
  optional,
} from "valibot";

// ─── output types ────────────────────────────────────────────────────────

export type Model = {
  id: string;
  name: string;
  providers: Provider[];
  elo_direct: number | null;
  elo_thinking: number | null;
  token_use_direct?: number;
  token_use_thinking?: number;
};

export type Provider = {
  provider: string;
  model_id: string;
  context_length: number;
  per_mtok?: { prompt: number; completion: number };
  input_modalities: string[];
  output_modalities: string[];
  tps: number | null;
  ttfb: number | null;
  cost_multiplier?: number;
  reasoning_efforts: (string | null)[];
  note?: string;
  extra?: Record<string, unknown>;
};

// ─── API response schemas ────────────────────────────────────────────────

export const ORModelSchema = object({
  id: string(),
  name: string(),
  context_length: number(),
  architecture: object({
    input_modalities: array(string()),
    output_modalities: array(string()),
  }),
  pricing: object({
    prompt: string(),
    completion: string(),
  }),
  supported_parameters: array(string()),
});
export type ORModel = InferOutput<typeof ORModelSchema>;

export const GroqModelSchema = object({
  id: string(),
  context_window: number(),
});
export type GroqModel = InferOutput<typeof GroqModelSchema>;

export const CerebrasModelSchema = object({
  id: string(),
});
export type CerebrasModel = InferOutput<typeof CerebrasModelSchema>;

export const GoogleModelSchema = object({
  name: string(),
  inputTokenLimit: number(),
  supportedGenerationMethods: array(string()),
});
export type GoogleModel = InferOutput<typeof GoogleModelSchema>;

export const CrofModelSchema = object({
  id: string(),
  context_length: number(),
  pricing: object({ prompt: string(), completion: string() }),
  quantization: string(),
  reasoning_effort: optional(boolean()),
  custom_reasoning: optional(boolean()),
  speed: number(),
});
export type CrofModel = InferOutput<typeof CrofModelSchema>;

const ThroughputSchema = object({
  p50: number(),
});

const LatencySchema = object({
  p50: number(),
});

export const EndpointDataSchema = object({
  model_id: string(),
  tag: string(),
  context_length: number(),
  pricing: object({
    prompt: string(),
    completion: string(),
  }),
  quantization: string(),
  throughput_last_30m: nullable(ThroughputSchema),
  latency_last_30m: nullable(LatencySchema),
});
export type EndpointData = InferOutput<typeof EndpointDataSchema>;

// ─── wrapper schemas for API responses ───────────────────────────────────

export const ORResponseSchema = object({ data: array(ORModelSchema) });
export const HackClubStatusSchema = object({
  balanceRemaining: number(),
  dailyKeyUsageRemaining: number(),
});
export const CrofResponseSchema = object({ data: array(CrofModelSchema) });
export const GroqResponseSchema = object({ data: array(GroqModelSchema) });
export const CerebrasResponseSchema = object({
  data: array(CerebrasModelSchema),
});
export const GoogleResponseSchema = object({
  models: array(GoogleModelSchema),
});
export const EndpointArraySchema = array(EndpointDataSchema);
