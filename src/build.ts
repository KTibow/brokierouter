import { writeFileSync, existsSync, readdirSync } from "node:fs";
import type {
  Model,
  Provider,
  ORModel,
  GHMModel,
  GHCModel,
  CrofModel,
  GroqModel,
  CerebrasModel,
  GoogleModel,
  EndpointData,
} from "./types.ts";
import {
  ORResponseSchema,
  GHMResponseSchema,
  GHCResponseSchema,
  CrofResponseSchema,
  GroqResponseSchema,
  CerebrasResponseSchema,
  GoogleResponseSchema,
  EndpointArraySchema,
} from "./types.ts";
import {
  fetchJSON,
  fetchValidated,
  readJSON,
  readJSONOr,
  readValidated,
} from "./lib/fetch.ts";
import { displayName } from "./lib/normalize.ts";
import {
  BENCHMARKS,
  GROQ_TPM,
  CROF_MAP,
  CROF_VISION,
  GROQ_VISION,
  GROQ_SKIP,
  CEREBRAS_SKIP,
  CEREBRAS_CONTEXT,
  GHM_SKIP,
  GHM_ID_TO_OR,
  GHC_ID_TO_OR,
  GROQ_ID_TO_OR,
  CEREBRAS_ID_TO_OR,
  GOOGLE_NAME_TO_OR,
  getReasoningEfforts,
  REASONING_EFFORT_OVERRIDES,
  MODEL_SKIP,
  FAST_MODEL_MAP,
  TOKEN_USE_PROXIES,
} from "./lib/constants.ts";

// ─── helpers ─────────────────────────────────────────────────────────────

const isEffortVariant = (id: string): boolean =>
  /:(thinking|extended)$/.test(id) || /-(high|low)$/.test(id);

const requireContextLength = (
  value: number | undefined,
  source: string,
): number => {
  if (!value) throw new Error(`Missing context_length for ${source}`);
  return value;
};

const requireModalities = (
  value: string[] | undefined,
  field: string,
  source: string,
): string[] => {
  if (!value || !value.length)
    throw new Error(`Missing ${field} for ${source}`);
  return value;
};

// ─── build endpoint provider from raw endpoint data ─────────────────────

const endpointToProvider = (
  m: ORModel,
  ep: EndpointData,
  providerName: string,
  note?: string,
): Provider => {
  const tps = ep.throughput_last_30m?.p50 ?? null;
  const ttfb = ep.latency_last_30m?.p50 ?? null;
  return {
    provider: providerName,
    model_id: ep.tag ? `${m.id};${ep.tag}` : m.id,
    context_length: requireContextLength(
      ep.context_length,
      `endpoint ${ep.model_id}/${ep.tag}`,
    ),
    per_mtok: {
      prompt: parseFloat(ep.pricing.prompt) * 1_000_000,
      completion: parseFloat(ep.pricing.completion) * 1_000_000,
    },
    input_modalities: requireModalities(
      m.architecture.input_modalities,
      "input_modalities",
      m.id,
    ),
    output_modalities: requireModalities(
      m.architecture.output_modalities,
      "output_modalities",
      m.id,
    ),
    tps,
    ttfb,
    reasoning_efforts: getReasoningEfforts(
      m.id.replace(":free", ""),
      undefined,
      m.supported_parameters.includes("reasoning"),
    ),
    note,
    extra: {
      quantization: ep.quantization !== "unknown" ? ep.quantization : undefined,
    },
  };
};

// ─── providers ──────────────────────────────────────────────────────────

type ParseResult = { providers: Map<string, Provider[]>; unmapped: string[] };

const providers = {
  openrouter: {
    async fetch() {
      return fetchValidated(
        "https://openrouter.ai/api/v1/models",
        ORResponseSchema,
      );
    },
    parse(
      raw: { data: ORModel[] },
      endpointData: Record<string, EndpointData[]>,
    ): Map<string, { name: string; providers: Provider[] }> {
      const out = new Map<string, { name: string; providers: Provider[] }>();
      const modelById = new Map<string, ORModel>();
      for (const m of raw.data) modelById.set(m.id, m);

      // Process endpoints first — each endpoint is one provider
      for (const [queriedId, endpoints] of Object.entries(endpointData)) {
        const norm = queriedId.replace(":free", "");
        if (
          endpoints.length &&
          endpoints.every((ep) => ep.model_id.replace(":free", "") !== norm)
        ) {
          console.warn(`Redirect: ${queriedId} → ${endpoints[0]!.model_id}`);
          continue;
        }
        for (const ep of endpoints) {
          if (!ep.context_length) continue;
          const m = modelById.get(ep.model_id);
          if (!m) continue;
          const id = ep.model_id.replace(":free", "");
          if (isEffortVariant(id)) continue;
          const fastBase = FAST_MODEL_MAP[id];
          const targetId = fastBase ?? id;
          if (!out.has(targetId)) {
            const nameModel = fastBase ? modelById.get(fastBase) : m;
            out.set(targetId, {
              name: displayName(
                (nameModel ?? m).name
                  .replace(/^[^:]+:\s*/, "")
                  .replace(/\s*\(free\)\s*$/i, ""),
              ),
              providers: [],
            });
          }
          const epFree =
            ep.pricing.prompt === "0" &&
            ep.pricing.completion === "0" &&
            !m.architecture.output_modalities.includes("audio");
          const base = epFree ? "openrouter-free" : "openrouter";
          out.get(targetId)!.providers.push(
            endpointToProvider(
              m,
              ep,
              base,
              fastBase ? "fast tier" : undefined,
            ),
          );
        }
      }

      return out;
    },
  },

  hackclub: {
    async fetch() {
      return fetchValidated(
        "https://ai.hackclub.com/proxy/v1/models",
        ORResponseSchema,
      );
    },
    // Mirror OR providers (same sub-providers + TPS) for HC's model selection
    parse(
      raw: { data: ORModel[] },
      orModels: Map<string, { name: string; providers: Provider[] }>,
    ): ParseResult {
      const providers = new Map<string, Provider[]>();
      for (const m of raw.data) {
        const id = m.id.replace(":free", "");
        if (isEffortVariant(id)) continue;
        if (FAST_MODEL_MAP[id]) continue;
        const orEntry = orModels.get(id);
        if (orEntry) {
          // Copy OR's providers with hack-club prefix
          const hcProvs = orEntry.providers
            .filter(
              (p) =>
                p.provider === "openrouter" && // not openrouter-free
                !p.model_id.includes(";cerebras"), // HC has banned Cerebras
            )
            .map(
              (p): Provider => ({
                ...p,
                provider: "hack-club",
              }),
            );
          if (hcProvs.length) providers.set(id, hcProvs);
        } else {
          // Fallback for models not in OR
          providers.set(id, [
            {
              provider: "hack-club",
              model_id: m.id,
              context_length: requireContextLength(
                m.context_length,
                `hackclub fallback ${m.id}`,
              ),
              per_mtok: {
                prompt: parseFloat(m.pricing.prompt) * 1_000_000,
                completion: parseFloat(m.pricing.completion) * 1_000_000,
              },
              input_modalities: requireModalities(
                m.architecture.input_modalities,
                "input_modalities",
                m.id,
              ),
              output_modalities: requireModalities(
                m.architecture.output_modalities,
                "output_modalities",
                m.id,
              ),
              tps: null,
              ttfb: null,
              reasoning_efforts: getReasoningEfforts(
                id,
                undefined,
                m.supported_parameters.includes("reasoning"),
              ),
            },
          ]);
        }
      }
      return { providers, unmapped: [] };
    },
  },

  crof: {
    async fetch() {
      return fetchValidated("https://crof.ai/v2/models", CrofResponseSchema, {
        token: process.env.CROF_KEY ?? "",
      });
    },
    parse(raw: { data: CrofModel[] }): ParseResult {
      const providers = new Map<string, Provider[]>();
      const unmapped: string[] = [];
      for (const m of raw.data) {
        const mapping = CROF_MAP[m.id];
        const orId = mapping?.orId ?? m.id;
        if (!mapping) unmapped.push(m.id);
        const provider: Provider = {
          provider: "crofai",
          model_id: m.id,
          note: mapping?.variant ? `${mapping.variant} variant` : undefined,
          context_length: requireContextLength(
            m.context_length,
            `crofai ${m.id}`,
          ),
          per_mtok: {
            prompt: parseFloat(m.pricing.prompt),
            completion: parseFloat(m.pricing.completion),
          },
          input_modalities: CROF_VISION.has(m.id)
            ? ["text", "image"]
            : ["text"],
          output_modalities: ["text"],
          tps: m.speed ? Math.min(m.speed, 100) : null,
          ttfb: null,
          reasoning_efforts: getReasoningEfforts(
            orId,
            "crofai",
            undefined,
            m.id,
          ),
          extra: { quantization: m.quantization || undefined },
        };
        const arr = providers.get(orId);
        if (arr) arr.push(provider);
        else providers.set(orId, [provider]);
      }
      return { providers, unmapped };
    },
  },

  ghm: {
    async fetch() {
      return fetchValidated(
        "https://models.github.ai/catalog/models",
        GHMResponseSchema,
        {
          token: process.env.GHM_KEY ?? "",
        },
      );
    },
    parse(raw: GHMModel[]): ParseResult {
      const providers = new Map<string, Provider[]>();
      const capped4000 = new Set([
        "deepseek/deepseek-r1",
        "deepseek/deepseek-r1-0528",
        "microsoft/mai-ds-r1",
        "x-ai/grok-3",
        "x-ai/grok-3-mini",
        "openai/gpt-5",
        "openai/gpt-5-mini",
        "openai/gpt-5-nano",
        "openai/gpt-5-chat",
      ]);
      for (const m of raw) {
        const orId = GHM_ID_TO_OR[m.id] ?? m.id;
        if (GHM_SKIP.has(m.id)) continue;
        let context = Math.min(m.limits.max_input_tokens, 8000);
        if (capped4000.has(orId)) context = Math.min(context, 4000);
        providers.set(orId, [
          {
            provider: "github-models",
            model_id: m.id,
            context_length: context,
            input_modalities: m.supported_input_modalities,
            output_modalities: m.supported_output_modalities,
            tps: null,
            ttfb: null,
            reasoning_efforts: getReasoningEfforts(orId, "github-models"),
          },
        ]);
      }
      return { providers, unmapped: [] };
    },
  },

  ghc: {
    async fetch() {
      // Step 1: exchange GitHub OAuth token for a temporary Copilot access token
      const ghToken = process.env.GHC_KEY ?? "";
      const tokenRes = await fetch(
        "https://api.github.com/copilot_internal/v2/token",
        { headers: { authorization: `bearer ${ghToken}` } },
      );
      if (!tokenRes.ok)
        throw new Error(
          `GHC token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`,
        );
      const { token: copilotToken } = (await tokenRes.json()) as {
        token: string;
        expires_at: number;
      };
      // Step 2: fetch models using the Copilot access token
      return fetchValidated(
        "https://api.githubcopilot.com/models",
        GHCResponseSchema,
        {
          token: copilotToken,
          headers: {
            "editor-version": "vscode/0-insider",
            "x-github-api-version": "2025-05-01",
          },
        },
      );
    },
    parse(raw: { data: GHCModel[] }): ParseResult {
      const providers = new Map<string, Provider[]>();
      const unmapped: string[] = [];
      for (const m of raw.data) {
        if (m.policy?.state === "off") continue;
        if (!m.model_picker_enabled) continue;
        if (m.capabilities?.type !== "chat") continue;
        const orId = GHC_ID_TO_OR[m.id] ?? m.id;
        if (!GHC_ID_TO_OR[m.id]) unmapped.push(m.id);
        const provider: Provider = {
          provider: "github-copilot",
          model_id: m.id,
          context_length: requireContextLength(
            m.capabilities?.limits?.max_context_window_tokens,
            `ghc ${m.id}`,
          ),
          tps: null,
          ttfb: null,
          reasoning_efforts: getReasoningEfforts(orId),
          cost_multiplier: m.billing?.multiplier,
          input_modalities: m.capabilities?.supports?.vision
            ? ["text", "image"]
            : ["text"],
          output_modalities: ["text"],
          extra: {
            model_picker_enabled: m.model_picker_enabled,
            supported_endpoints: m.supported_endpoints,
          },
        };
        providers.set(orId, [provider]);
      }
      return { providers, unmapped };
    },
  },

  groq: {
    async fetch() {
      return fetchValidated(
        "https://api.groq.com/openai/v1/models",
        GroqResponseSchema,
        { token: process.env.GROQ_KEY ?? "" },
      );
    },
    parse(raw: { data: GroqModel[] }): ParseResult {
      const providers = new Map<string, Provider[]>();
      const unmapped: string[] = [];
      for (const m of raw.data) {
        if (GROQ_SKIP.has(m.id)) continue;
        const orId = GROQ_ID_TO_OR[m.id] ?? m.id;
        if (!GROQ_ID_TO_OR[m.id]) unmapped.push(m.id);
        const tpm = GROQ_TPM[m.id];
        const context = tpm
          ? Math.min(m.context_window, tpm)
          : m.context_window;
        providers.set(orId, [
          {
            provider: "groq-free",
            model_id: m.id,
            context_length: requireContextLength(context, `groq ${m.id}`),
            input_modalities: GROQ_VISION.has(m.id)
              ? ["text", "image"]
              : ["text"],
            output_modalities: ["text"],
            tps: null,
            ttfb: null,
            reasoning_efforts: getReasoningEfforts(orId, "groq-free"),
          },
        ]);
      }
      return { providers, unmapped };
    },
  },

  cerebras: {
    async fetch() {
      return fetchValidated(
        "https://api.cerebras.ai/v1/models",
        CerebrasResponseSchema,
        { token: process.env.CEREBRAS_KEY ?? "" },
      );
    },
    parse(raw: { data: CerebrasModel[] }): ParseResult {
      const providers = new Map<string, Provider[]>();
      const unmapped: string[] = [];
      const skip = CEREBRAS_SKIP;
      for (const m of raw.data) {
        if (skip.has(m.id)) continue;
        const orId = CEREBRAS_ID_TO_OR[m.id] ?? m.id;
        if (!CEREBRAS_ID_TO_OR[m.id]) unmapped.push(m.id);
        providers.set(orId, [
          {
            provider: "cerebras-free",
            model_id: m.id,
            context_length: requireContextLength(
              CEREBRAS_CONTEXT[m.id],
              `cerebras ${m.id}`,
            ),
            input_modalities: ["text"],
            output_modalities: ["text"],
            tps: null,
            ttfb: null,
            reasoning_efforts: getReasoningEfforts(orId, "cerebras-free"),
          },
        ]);
      }
      return { providers, unmapped };
    },
  },

  google: {
    async fetch() {
      return fetchValidated(
        "https://generativelanguage.googleapis.com/v1beta/models",
        GoogleResponseSchema,
        { headers: { "x-goog-api-key": process.env.GOOGLE_KEY ?? "" } },
      );
    },
    parse(raw: { models: GoogleModel[] }): ParseResult {
      const providers = new Map<string, Provider[]>();
      const unmapped: string[] = [];
      for (const m of raw.models) {
        if (!m.supportedGenerationMethods.includes("generateContent")) continue;
        const googleName = m.name.replace("models/", "");
        const orId = GOOGLE_NAME_TO_OR[m.name] ?? googleName;
        // Only include models that have been benchmarked successfully
        if (!BENCHMARKS[orId]?.["google-free"]) continue;
        if (!GOOGLE_NAME_TO_OR[m.name]) unmapped.push(m.name);
        providers.set(orId, [
          {
            provider: "google-free",
            model_id: m.name.replace("models/", ""),
            context_length: requireContextLength(
              m.inputTokenLimit,
              `google ${m.name}`,
            ),
            input_modalities: ["text"],
            output_modalities: ["text"],
            tps: null,
            ttfb: null,
            reasoning_efforts: getReasoningEfforts(orId, "google-free"),
          },
        ]);
      }
      return { providers, unmapped };
    },
  },
} as const;

// ─── merge ──────────────────────────────────────────────────────────────

type EloMap = Record<
  string,
  { elo_direct: number | null; elo_thinking: number | null }
>;

// Reconstruct old-style "provider/tag" key for benchmark & override lookups
const providerKey = (p: Provider): string => {
  const idx = p.model_id.lastIndexOf(";");
  if (idx === -1) return p.provider;
  return `${p.provider}/${p.model_id.slice(idx + 1)}`;
};

const merge = (
  orModels: Map<string, { name: string; providers: Provider[] }>,
  hcResult: ParseResult,
  providerResults: { name: string; result: ParseResult }[],
  elos: EloMap,
): Model[] => {
  const dropped: string[] = [];
  const unofficial: string[] = [];

  const models = new Map<string, Model>();

  // Seed from OpenRouter
  for (const [id, { name, providers: provs }] of orModels) {
    models.set(id, {
      id,
      name,
      providers: provs.map((p) => ({ ...p, tps: p.tps ?? null, ttfb: p.ttfb ?? null })),
      elo_direct: elos[id]?.elo_direct ?? null,
      elo_thinking: elos[id]?.elo_thinking ?? null,
      ...(TOKEN_USE_PROXIES[id]?.direct !== undefined
        ? { token_use_direct: TOKEN_USE_PROXIES[id].direct }
        : {}),
      ...(TOKEN_USE_PROXIES[id]?.thinking !== undefined
        ? { token_use_thinking: TOKEN_USE_PROXIES[id].thinking }
        : {}),
    });
  }

  const ensureModel = (id: string, nameFallback: string, source?: string) => {
    if (!models.has(id)) {
      if (source) unofficial.push(id);
      models.set(id, {
        id,
        name: displayName(nameFallback),
        providers: [],
        elo_direct: elos[id]?.elo_direct ?? null,
        elo_thinking: elos[id]?.elo_thinking ?? null,
        ...(TOKEN_USE_PROXIES[id]?.direct !== undefined
          ? { token_use_direct: TOKEN_USE_PROXIES[id].direct }
          : {}),
        ...(TOKEN_USE_PROXIES[id]?.thinking !== undefined
          ? { token_use_thinking: TOKEN_USE_PROXIES[id].thinking }
          : {}),
      });
    }
  };

  const addProvider = (
    id: string,
    provider: Provider,
    nameFallback: string,
    source?: string,
  ) => {
    if (!id.includes("/")) {
      dropped.push(`${source ?? "???"}: "${id}"`);
      return;
    }
    ensureModel(id, nameFallback, source);
    const model = models.get(id)!;
    if (
      model.providers.some(
        (p) =>
          p.provider === provider.provider &&
          p.model_id === provider.model_id,
      )
    )
      return;
    model.providers.push({
      ...provider,
      tps: provider.tps ?? null,
      ttfb: provider.ttfb ?? null,
    });
  };

  // Add HC using mirrored OR data
  for (const [id, provs] of hcResult.providers) {
    for (const p of provs) addProvider(id, p, id, "HC");
  }

  for (const { name: source, result } of providerResults) {
    for (const [id, provs] of result.providers) {
      for (const p of provs) addProvider(id, p, id, source);
    }
    for (const id of result.unmapped)
      console.warn(`${source}: needs mapping "${id}"`);
  }

  // Apply benchmark TPS + TTFB (only for non-OR providers)
  for (const model of models.values()) {
    const benchmarks = BENCHMARKS[model.id];
    if (!benchmarks) continue;
    for (const provider of model.providers) {
      const bench = benchmarks[providerKey(provider)];
      if (bench !== undefined) {
        provider.tps = bench.tps;
        provider.ttfb = bench.ttfb;
      }
    }
  }

  // Apply per-provider reasoning effort overrides
  for (const model of models.values()) {
    const overrides = REASONING_EFFORT_OVERRIDES[model.id];
    if (!overrides) continue;
    for (const provider of model.providers) {
      const allowed = overrides[providerKey(provider)];
      if (allowed) provider.reasoning_efforts = [...allowed];
    }
  }

  // Remove redundant dated checkpoints
  for (const id of MODEL_SKIP) models.delete(id);

  if (dropped.length) {
    console.warn(`\nDROPPED (${dropped.length}) — no OR-style ID:`);
    for (const d of dropped) console.warn(`  ${d}`);
  }
  if (unofficial.length) {
    console.warn(
      `\nUnofficial IDs (${unofficial.length}) — not in OpenRouter catalog:`,
    );
    for (const id of unofficial) console.warn(`  ${id}`);
  }

  return [...models.values()].sort((a, b) => {
    const aElo = Math.max(a.elo_direct ?? 0, a.elo_thinking ?? 0);
    const bElo = Math.max(b.elo_direct ?? 0, b.elo_thinking ?? 0);
    return bElo - aElo;
  });
};

// ─── main ───────────────────────────────────────────────────────────────

const elos: EloMap = readJSONOr("data/arena.json", null) ?? {};

const endpointData: Record<string, EndpointData[]> = {};
if (existsSync("data/endpoints")) {
  for (const file of readdirSync("data/endpoints")) {
    if (!file.endsWith(".json")) continue;
    const modelId = file.replace(/\.json$/, "").replace(/_/g, "/");
    endpointData[modelId] = readValidated(
      `data/endpoints/${file}`,
      EndpointArraySchema,
    );
  }
}

// Fetch all providers in parallel
const [
  orData,
  hcData,
  crofData,
  ghmData,
  ghcData,
  groqData,
  cerebrasData,
  googleData,
] = await Promise.all([
  providers.openrouter.fetch(),
  providers.hackclub.fetch().catch((e) => {
    console.warn("Hack Club fetch failed:", e.message);
    return { data: [] };
  }),
  providers.crof.fetch().catch((e) => {
    console.warn("CrofAI fetch failed:", e.message);
    return { data: [] };
  }),
  providers.ghm.fetch().catch((e) => {
    console.warn("GHM fetch failed:", e.message);
    return [];
  }),
  providers.ghc.fetch().catch((e) => {
    console.warn("GHC fetch failed:", e.message);
    return { data: [] };
  }),
  providers.groq.fetch().catch((e) => {
    console.warn("Groq fetch failed:", e.message);
    return { data: [] };
  }),
  providers.cerebras.fetch().catch((e) => {
    console.warn("Cerebras fetch failed:", e.message);
    return { data: [] };
  }),
  providers.google.fetch().catch((e) => {
    console.warn("Google fetch failed:", e.message);
    return { models: [] };
  }),
]);

const providerResults = [
  { name: "Crof", result: providers.crof.parse(crofData) },
  { name: "GHM", result: providers.ghm.parse(ghmData) },
  { name: "GHC", result: providers.ghc.parse(ghcData) },
  { name: "Groq", result: providers.groq.parse(groqData) },
  { name: "Cerebras", result: providers.cerebras.parse(cerebrasData) },
  { name: "Google", result: providers.google.parse(googleData) },
];

const orModels = providers.openrouter.parse(orData, endpointData);
const hcResult = providers.hackclub.parse(hcData, orModels);

const models = merge(
  orModels,
  hcResult,
  providerResults,
  elos,
);
writeFileSync("models.json", JSON.stringify(models, null, 2));
console.log(`Built models.json with ${models.length} models`);
