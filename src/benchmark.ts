import { readFileSync, writeFileSync } from "node:fs";
import type { Provider } from "./types.ts";
import {
  GROQ_ID_TO_OR,
  CEREBRAS_ID_TO_OR,
  GOOGLE_NAME_TO_OR,
  CROF_MAP,
} from "./lib/constants.ts";

// ─── SSE parser ─────────────────────────────────────────────────────────

async function* parseSSE(r: Response): AsyncGenerator<string[]> {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const bytes of r.body!) {
    buffer += decoder.decode(bytes);

    let lines: string[];
    [lines, buffer] = [
      buffer.split("\n").slice(0, -1),
      buffer.split("\n").at(-1)!,
    ];

    let datas: string[] = [];
    for (const line of lines) {
      const data = line.startsWith("data: ") && line.slice(6).trim();
      if (!data) continue;
      if (data == "[DONE]") break;
      datas.push(data);
    }

    if (datas.length) {
      yield datas;
    }
  }
}

// ─── extract content text from a chunk ──────────────────────────────────

const extractContent = (json: string): string => {
  try {
    const parsed = JSON.parse(json);
    // OpenAI-compatible format
    const delta = parsed.choices?.[0]?.delta;
    if (delta?.content) return delta.content;
    // Google format (in SSE wrapper)
    if (parsed.candidates?.[0]?.content?.parts?.[0]?.text)
      return parsed.candidates[0].content.parts[0].text;
    return "";
  } catch {
    return "";
  }
};

// ─── provider configs ───────────────────────────────────────────────────

type ProviderConfig = {
  /** Friendly name for the provider */
  name: string;
  /** Fetch list of model IDs (provider-native) from the provider */
  fetchModels(): Promise<{ model_id: string; or_id: string }[]>;
  /** Build a streaming chat completion request for a model */
  streamRequest(model_id: string): Promise<Response>;
};

const PROVIDERS: Record<string, ProviderConfig> = {
  crofai: {
    name: "CrofAI",
    async fetchModels() {
      const res = await fetch("https://crof.ai/v2/models", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.CROF_KEY ?? ""}`,
        },
      });
      if (!res.ok) throw new Error(`Crof fetch failed: ${res.status}`);
      const { data } = (await res.json()) as { data: { id: string }[] };
      return data.map((m) => {
        const mapping = CROF_MAP[m.id];
        return {
          model_id: m.id,
          or_id: mapping?.orId ?? m.id,
        };
      });
    },
    async streamRequest(model_id) {
      const r = await fetch("https://crof.ai/v2/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CROF_KEY ?? ""}`,
        },
        body: JSON.stringify({
          model: model_id,
          messages: [{ role: "user", content: "List all US presidents." }],
          stream: true,
        }),
      });
      if (!r.ok) throw new Error(`Crof stream failed: ${r.status}`);
      return r;
    },
  },

  "groq-free": {
    name: "Groq",
    async fetchModels() {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.GROQ_KEY ?? ""}`,
        },
      });
      if (!res.ok) throw new Error(`Groq fetch failed: ${res.status}`);
      const { data } = (await res.json()) as { data: { id: string }[] };
      const skip = new Set([
        "whisper-large-v3",
        "whisper-large-v3-turbo",
        "meta-llama/llama-prompt-guard-2-22m",
        "meta-llama/llama-prompt-guard-2-86m",
        "openai/gpt-oss-safeguard-20b",
        "canopylabs/orpheus-arabic-saudi",
        "canopylabs/orpheus-v1-english",
      ]);
      return data
        .filter((m) => !skip.has(m.id))
        .map((m) => ({
          model_id: m.id,
          or_id: GROQ_ID_TO_OR[m.id] ?? m.id,
        }));
    },
    async streamRequest(model_id) {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_KEY ?? ""}`,
        },
        body: JSON.stringify({
          model: model_id,
          messages: [{ role: "user", content: "List all US presidents." }],
          stream: true,
        }),
      });
      if (!r.ok) throw new Error(`Groq stream failed: ${r.status}`);
      return r;
    },
  },

  "cerebras-free": {
    name: "Cerebras",
    async fetchModels() {
      const res = await fetch("https://api.cerebras.ai/v1/models", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.CEREBRAS_KEY ?? ""}`,
        },
      });
      if (!res.ok) throw new Error(`Cerebras fetch failed: ${res.status}`);
      const { data } = (await res.json()) as { data: { id: string }[] };
      return data.map((m) => ({
        model_id: m.id,
        or_id: CEREBRAS_ID_TO_OR[m.id] ?? m.id,
      }));
    },
    async streamRequest(model_id) {
      const r = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CEREBRAS_KEY ?? ""}`,
        },
        body: JSON.stringify({
          model: model_id,
          messages: [{ role: "user", content: "List all US presidents." }],
          stream: true,
        }),
      });
      if (!r.ok) throw new Error(`Cerebras stream failed: ${r.status}`);
      return r;
    },
  },

  "google-free": {
    name: "Google",
    async fetchModels() {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models`,
        {
          headers: { "x-goog-api-key": process.env.GOOGLE_KEY ?? "" },
        },
      );
      if (!res.ok) throw new Error(`Google fetch failed: ${res.status}`);
      const { models } = (await res.json()) as {
        models: {
          name: string;
          supportedGenerationMethods: string[];
        }[];
      };
      return models
        .filter((m) => m.supportedGenerationMethods.includes("generateContent"))
        .filter((m) => !m.name.endsWith("-latest"))
        .map((m) => {
          const googleName = m.name.replace("models/", "");
          return {
            model_id: googleName,
            or_id: GOOGLE_NAME_TO_OR[m.name] ?? googleName,
          };
        });
    },
    async streamRequest(model_id) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model_id}:streamGenerateContent?alt=sse&key=${process.env.GOOGLE_KEY ?? ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "List all US presidents." }] }],
          }),
        },
      );
      if (!r.ok) throw new Error(`Google stream failed: ${r.status}`);
      return r;
    },
  },
};

// ─── main ───────────────────────────────────────────────────────────────

const providerKey = process.argv[2];
if (!providerKey || !PROVIDERS[providerKey]) {
  console.error(
    `Usage: node --env-file=.env src/benchmark.ts <provider>\nProviders: ${Object.keys(PROVIDERS).join(", ")}`,
  );
  process.exit(1);
}

const config = PROVIDERS[providerKey];
console.log(`Fetching models from ${config.name}...`);
const models = await config.fetchModels();
console.log(`Found ${models.length} models\n`);

const BENCHMARKS_PATH = new URL("./lib/benchmarks.json", import.meta.url)
  .pathname;
const benchmarks: Record<
  string,
  Record<string, { tps: number; ttfb: number }>
> = JSON.parse(readFileSync(BENCHMARKS_PATH, "utf-8"));

const results: Record<string, Record<string, { tps: number; ttfb: number }>> = {};

for (const { model_id, or_id } of models) {
  try {
    const start = performance.now();
    const res = await config.streamRequest(model_id);
    let firstContentTime: number | null = null;
    let lastContentTime = start;
    let content = "";
    let finishReason = "";
    let actualModel = "";

    for await (const datas of parseSSE(res)) {
      for (const data of datas) {
        const chunk = extractContent(data);
        if (chunk) {
          const now = performance.now();
          if (firstContentTime === null) firstContentTime = now;
          lastContentTime = now;
          content += chunk;
        }
        try {
          const parsed = JSON.parse(data);
          if (!finishReason) {
            const reason = parsed.choices?.[0]?.finish_reason;
            if (reason) finishReason = reason;
          }
          if (!actualModel && parsed.model) actualModel = parsed.model;
        } catch {}
      }
    }

    if (!firstContentTime || !content.length) {
      console.log(`  ${or_id} (${model_id}): no content produced, skipping`);
      continue;
    }

    const ttfb = Math.round(firstContentTime - start);
    const totalTime = Math.round(lastContentTime - start);
    const charCount = content.length;
    // Rough token estimate: ~4 chars per token
    const tokenEstimate = charCount / 4;
    const streamingTime = lastContentTime - firstContentTime;
    const rawTps =
      streamingTime > 0
        ? Math.round((tokenEstimate / streamingTime) * 1000)
        : 0;
    const tps = Math.min(rawTps, providerKey === "ghm" ? 200 : 2000);

    const modelNote =
      actualModel && actualModel !== model_id
        ? ` | actual: ${actualModel}`
        : "";
    console.log(
      `  ${or_id} (${model_id}): ${tps} tps | ttfb ${ttfb}ms | ${totalTime}ms total | ${charCount} chars (~${Math.round(tokenEstimate)} tokens) | finish: ${finishReason || "unknown"}${modelNote}`,
    );

    results[or_id] ??= {};
    results[or_id][providerKey] = { tps, ttfb };
  } catch (e) {
    console.log(`  ${or_id} (${model_id}): ERROR - ${(e as Error).message}`);
  }
}

// Remove all old entries for this provider first
for (const entry of Object.values(benchmarks)) {
  delete entry[providerKey];
}

// Merge new results
for (const [modelId, providerTps] of Object.entries(results)) {
  if (!benchmarks[modelId]) benchmarks[modelId] = {};
  Object.assign(benchmarks[modelId], providerTps);
}

// Clean up empty entries
for (const [modelId, providers] of Object.entries(benchmarks)) {
  if (!Object.keys(providers).length) delete benchmarks[modelId];
}

// Sort by key
const sorted = Object.fromEntries(
  Object.entries(benchmarks).sort(([a], [b]) => a.localeCompare(b)),
);

writeFileSync(BENCHMARKS_PATH, JSON.stringify(sorted, null, 2) + "\n");
console.log(`\nUpdated ${BENCHMARKS_PATH}`);
