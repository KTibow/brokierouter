import { writeFileSync, existsSync, readdirSync } from "node:fs";
import type {
  Model,
  Provider,
  ORModel,
  CrofModel,
  GroqModel,
  CerebrasModel,
  GoogleModel,
  EndpointData,
} from "./types.ts";
import {
  ORResponseSchema,
  CrofResponseSchema,
  GroqResponseSchema,
  CerebrasResponseSchema,
  GoogleResponseSchema,
  EndpointArraySchema,
  HackClubStatusSchema,
  ZDRResponseSchema,
} from "./types.ts";
import { safeParse } from "valibot";
import { fetchValidated, readJSONOr, readValidated } from "./lib/fetch.ts";
import { displayName } from "./lib/normalize.ts";
import {
  BENCHMARKS,
  GROQ_TPM,
  CROF_MAP,
  CROF_VISION,
  GROQ_VISION,
  GROQ_SKIP,
  CEREBRAS_CONTEXT,
  GROQ_ID_TO_OR,
  CEREBRAS_ID_TO_OR,
  GOOGLE_NAME_TO_OR,
  MODEL_SKIP,
  FAST_MODEL_MAP,
  TOKEN_USE_PROXIES,
  HC_GEOBLOCKED,
  HC_BANNED_TAGS,
  HC_ZDR_ENFORCED_AUTHORS,
} from "./lib/constants.ts";
import {
  orReasoningEfforts,
  crofReasoningEfforts,
  getReasoningEfforts,
  REASONING_EFFORT_OVERRIDES,
} from "./lib/reasoning.ts";

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
    reasoning_efforts: orReasoningEfforts(m),
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
          if (id.startsWith("~")) continue; // ~author/family-latest aliases
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
          out
            .get(targetId)!
            .providers.push(
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
      const res = await fetch("https://ai.hackclub.com/up");
      const body: unknown = await res.json();
      const parsed = safeParse(HackClubStatusSchema, body);
      if (!parsed.success) {
        console.warn("Hack Club /up returned unexpected shape; skipping");
        return { data: [] };
      }
      const up = parsed.output;
      if (up.balanceRemaining <= 0 || up.dailyKeyUsageRemaining <= 0) {
        console.warn(
          `Hack Club OpenRouter unavailable (balance=${up.balanceRemaining}, daily=${up.dailyKeyUsageRemaining}); skipping`,
        );
        return { data: [] };
      }
      return fetchValidated(
        "https://ai.hackclub.com/proxy/v1/models",
        ORResponseSchema,
      );
    },
    // Mirror OR providers (same sub-providers + TPS) for HC's model selection
    parse(
      raw: { data: ORModel[] },
      orModels: Map<string, { name: string; providers: Provider[] }>,
      zdrEndpoints: Set<string>,
    ): Map<string, Provider[]> {
      // Which sub-provider endpoints are reachable through Hack Club's
      // OpenRouter account. `model_id` is "<or id>;<tag>".
      const zdrModels = new Set(
        [...zdrEndpoints].map((e) => e.split(";")[0]!),
      );
      const hcCanRoute = (p: Provider): boolean => {
        const [orId, tag] = p.model_id.split(";");
        if (HC_ZDR_ENFORCED_AUTHORS.has(orId!.split("/")[0]!)) {
          // Frontier model: only ZDR endpoints route. Without endpoint data
          // (no tag), keep the model iff it has any ZDR endpoint.
          if (!(tag ? zdrEndpoints.has(p.model_id) : zdrModels.has(orId!)))
            return false;
        }
        if (!tag) return true;
        return !HC_BANNED_TAGS.has(tag.split("/")[0]!);
      };

      const providers = new Map<string, Provider[]>();
      for (const m of raw.data) {
        const id = m.id.replace(":free", "");
        if (id.startsWith("~")) continue; // ~author/family-latest aliases
        if (providers.has(id)) continue; // HC's list repeats each model
        if (isEffortVariant(id)) continue;
        if (FAST_MODEL_MAP[id]) continue;
        if (HC_GEOBLOCKED.test(id)) continue;
        const orEntry = orModels.get(id);
        if (orEntry) {
          // Copy OR's providers with hack-club prefix
          const hcProvs = orEntry.providers
            .filter(
              (p) =>
                p.provider === "openrouter" && // not openrouter-free
                hcCanRoute(p),
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
          if (
            HC_ZDR_ENFORCED_AUTHORS.has(id.split("/")[0]!) &&
            !zdrModels.has(id)
          )
            continue;
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
              reasoning_efforts: orReasoningEfforts(m),
            },
          ]);
        }
      }
      return providers;
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
          reasoning_efforts: crofReasoningEfforts(m.id),
          extra: { quantization: m.quantization || undefined },
        };
        const arr = providers.get(orId);
        if (arr) arr.push(provider);
        else providers.set(orId, [provider]);
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
      for (const m of raw.data) {
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
  hcProviders: Map<string, Provider[]>,
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
      providers: provs.map((p) => ({
        ...p,
        tps: p.tps ?? null,
        ttfb: p.ttfb ?? null,
      })),
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
          p.provider === provider.provider && p.model_id === provider.model_id,
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
  for (const [id, provs] of hcProviders) {
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
  zdrData,
  crofData,
  groqData,
  cerebrasData,
  googleData,
] = await Promise.all([
  providers.openrouter.fetch(),
  providers.hackclub.fetch().catch((e) => {
    console.warn("Hack Club fetch failed:", e.message);
    return { data: [] };
  }),
  // If this fails, the empty set conservatively drops all ZDR-enforced
  // frontier endpoints from Hack Club
  fetchValidated(
    "https://openrouter.ai/api/v1/endpoints/zdr",
    ZDRResponseSchema,
  ).catch((e) => {
    console.warn("ZDR list fetch failed:", e.message);
    return { data: [] };
  }),
  providers.crof.fetch().catch((e) => {
    console.warn("CrofAI fetch failed:", e.message);
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
  { name: "Groq", result: providers.groq.parse(groqData) },
  { name: "Cerebras", result: providers.cerebras.parse(cerebrasData) },
  { name: "Google", result: providers.google.parse(googleData) },
];

const zdrEndpoints = new Set(
  zdrData.data.map((e) => `${e.model_id};${e.tag}`),
);

const orModels = providers.openrouter.parse(orData, endpointData);
const hcProviders = providers.hackclub.parse(hcData, orModels, zdrEndpoints);

const models = merge(orModels, hcProviders, providerResults, elos);
writeFileSync("models.json", JSON.stringify(models, null, 2));
console.log(`Built models.json with ${models.length} models`);
