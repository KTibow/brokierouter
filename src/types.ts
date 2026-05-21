import {
  type InferOutput,
  object,
  string,
  number,
  boolean,
  array,
  nullable,
  optional,
  union,
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

export const GHMModelSchema = object({
  id: string(),
  limits: object({
    max_input_tokens: number(),
    max_output_tokens: nullable(number()),
  }),
  supported_input_modalities: array(string()),
  supported_output_modalities: array(string()),
});
export type GHMModel = InferOutput<typeof GHMModelSchema>;

export const GHCModelSchema = object({
  id: string(),
  model_picker_enabled: boolean(),
  supported_endpoints: optional(
    array(
      union([
        string(),
        object({ id: string(), max_output_tokens: optional(number()) }),
      ]),
    ),
  ),
  billing: optional(object({ multiplier: optional(number()) })),
  policy: optional(object({ state: string() })),
  capabilities: optional(
    object({
      type: string(),
      limits: optional(
        object({
          max_context_window_tokens: optional(number()),
        }),
      ),
      supports: optional(
        object({
          vision: optional(boolean()),
          streaming: optional(boolean()),
        }),
      ),
    }),
  ),
});
export type GHCModel = InferOutput<typeof GHCModelSchema>;

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
export const GHMResponseSchema = array(GHMModelSchema);
export const GHCResponseSchema = object({ data: array(GHCModelSchema) });
export const CrofResponseSchema = object({ data: array(CrofModelSchema) });
export const GroqResponseSchema = object({ data: array(GroqModelSchema) });
export const CerebrasResponseSchema = object({
  data: array(CerebrasModelSchema),
});
export const GoogleResponseSchema = object({
  models: array(GoogleModelSchema),
});
export const EndpointArraySchema = array(EndpointDataSchema);
