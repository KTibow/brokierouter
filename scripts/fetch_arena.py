# /// script
# requires-python = ">=3.12"
# dependencies = ["datasets"]
# ///
import json
import os

from datasets import load_dataset

# Arena name → (OpenRouter slug, is_thinking)
ARENA_TO_OR: dict[str, tuple[str, bool]] = {
    # Amazon Nova
    "amazon-nova-lite-v1.0": ("amazon/nova-lite-v1", False),
    "amazon-nova-micro-v1.0": ("amazon/nova-micro-v1", False),
    "amazon-nova-pro-v1.0": ("amazon/nova-pro-v1", False),
    "nova-2-lite": ("amazon/nova-2-lite-v1", False),
    # Anthropic Claude 3 / 3.5 / 3.7
    "claude-3-haiku-20240307": ("anthropic/claude-3-haiku", False),
    "claude-3-5-haiku-20241022": ("anthropic/claude-3.5-haiku", False),
    "claude-3-7-sonnet-20250219": ("anthropic/claude-3.7-sonnet", False),
    "claude-3-7-sonnet-20250219-thinking-32k": (
        "anthropic/claude-3.7-sonnet",
        True,
    ),
    # Claude 4 family
    "claude-haiku-4-5-20251001": ("anthropic/claude-haiku-4.5", False),
    "claude-opus-4-20250514": ("anthropic/claude-opus-4", False),
    "claude-opus-4-20250514-thinking-16k": ("anthropic/claude-opus-4", True),
    "claude-opus-4-1-20250805": ("anthropic/claude-opus-4.1", False),
    "claude-opus-4-1-20250805-thinking-16k": ("anthropic/claude-opus-4.1", True),
    "claude-opus-4-5-20251101": ("anthropic/claude-opus-4.5", False),
    "claude-opus-4-5-20251101-thinking-32k": ("anthropic/claude-opus-4.5", True),
    "claude-opus-4-6": ("anthropic/claude-opus-4.6", False),
    "claude-opus-4-6-thinking": ("anthropic/claude-opus-4.6", True),
    "claude-opus-4-7": ("anthropic/claude-opus-4.7", False),
    "claude-opus-4-7-thinking": ("anthropic/claude-opus-4.7", True),
    "claude-opus-4-8": ("anthropic/claude-opus-4.8", False),
    "claude-opus-4-8-thinking": ("anthropic/claude-opus-4.8", True),
    "claude-sonnet-4-20250514": ("anthropic/claude-sonnet-4", False),
    "claude-sonnet-4-20250514-thinking-32k": ("anthropic/claude-sonnet-4", True),
    "claude-sonnet-4-5-20250929": ("anthropic/claude-sonnet-4.5", False),
    "claude-sonnet-4-5-20250929-thinking-32k": ("anthropic/claude-sonnet-4.5", True),
    "claude-sonnet-4-6": ("anthropic/claude-sonnet-4.6", False),
    "claude-sonnet-5-high": ("anthropic/claude-sonnet-5", True),
    "claude-fable-5": ("anthropic/claude-fable-5", True),
    # Cohere
    "command-a-03-2025": ("cohere/command-a", False),
    "command-r-08-2024": ("cohere/command-r-08-2024", False),
    # "command-r": ("cohere/command-r-08-2024", False),  # DUPLICATE of command-r-08-2024
    "command-r-plus-08-2024": ("cohere/command-r-plus-08-2024", False),
    # "command-r-plus": ("cohere/command-r-plus-08-2024", False),  # DUPLICATE
    # DeepSeek
    "deepseek-r1": ("deepseek/deepseek-r1", True),  # always-on reasoning
    "deepseek-r1-0528": ("deepseek/deepseek-r1-0528", True),
    "deepseek-v3": ("deepseek/deepseek-chat", False),
    "deepseek-v3-0324": ("deepseek/deepseek-chat-v3-0324", False),
    # hybrids
    "deepseek-v3.1": ("deepseek/deepseek-chat-v3.1", False),
    "deepseek-v3.1-thinking": ("deepseek/deepseek-chat-v3.1", True),
    "deepseek-v3.1-terminus": ("deepseek/deepseek-v3.1-terminus", False),
    "deepseek-v3.1-terminus-thinking": ("deepseek/deepseek-v3.1-terminus", True),
    "deepseek-v3.2": ("deepseek/deepseek-v3.2", False),
    "deepseek-v3.2-thinking": ("deepseek/deepseek-v3.2", True),
    "deepseek-v3.2-exp": ("deepseek/deepseek-v3.2-exp", False),
    "deepseek-v3.2-exp-thinking": ("deepseek/deepseek-v3.2-exp", True),
    "deepseek-v4-pro": ("deepseek/deepseek-v4-pro", False),
    "deepseek-v4-pro-thinking": ("deepseek/deepseek-v4-pro", True),
    "deepseek-v4-flash": ("deepseek/deepseek-v4-flash", False),
    "deepseek-v4-flash-thinking": ("deepseek/deepseek-v4-flash", True),
    # Google Gemini
    "gemini-2.0-flash-001": ("google/gemini-2.0-flash-001", False),
    "gemini-2.5-flash": ("google/gemini-2.5-flash", False),
    "gemini-2.5-flash-lite-preview-06-17-thinking": (
        "google/gemini-2.5-flash-lite",
        True,
    ),
    "gemini-2.5-flash-lite-preview-09-2025-no-thinking": (
        "google/gemini-2.5-flash-lite-preview-09-2025",
        False,
    ),
    "gemini-2.5-pro": ("google/gemini-2.5-pro", True),  # adaptive thinking
    "gemini-3-flash": ("google/gemini-3-flash-preview", True),
    "gemini-3-flash (thinking-minimal)": ("google/gemini-3-flash-preview", False),
    "gemini-3.1-flash-lite-preview": ("google/gemini-3.1-flash-lite", False),
    "gemini-3.1-pro-preview": ("google/gemini-3.1-pro-preview", True),
    "gemini-3.5-flash-medium": ("google/gemini-3.5-flash", True),
    # Google Gemma
    "gemma-2-27b-it": ("google/gemma-2-27b-it", False),
    "gemma-3-12b-it": ("google/gemma-3-12b-it", False),
    "gemma-3-27b-it": ("google/gemma-3-27b-it", False),
    "gemma-3-4b-it": ("google/gemma-3-4b-it", False),
    "gemma-3n-e4b-it": ("google/gemma-3n-e4b-it", False),
    "gemma-4-26b-a4b": ("google/gemma-4-26b-a4b-it", True),
    "gemma-4-31b": ("google/gemma-4-31b-it", True),
    # Z.ai GLM
    "glm-4.5": ("z-ai/glm-4.5", True),
    "glm-4.5-air": ("z-ai/glm-4.5-air", True),
    "glm-4.5v": ("z-ai/glm-4.5v", True),
    "glm-4.6": ("z-ai/glm-4.6", True),
    "glm-4.6v": ("z-ai/glm-4.6v", True),
    "glm-4.7": ("z-ai/glm-4.7", True),
    "glm-4.7-flash": ("z-ai/glm-4.7-flash", True),
    "glm-5": ("z-ai/glm-5", True),
    "glm-5.1": ("z-ai/glm-5.1", True),
    "glm-5.2 (max)": ("z-ai/glm-5.2", True),
    # OpenAI GPT / o-series
    "gpt-3.5-turbo-0125": ("openai/gpt-3.5-turbo", False),
    "gpt-4-0314": ("openai/gpt-4-0314", False),
    "gpt-4-0613": ("openai/gpt-4", False),
    "gpt-4-1106-preview": ("openai/gpt-4-1106-preview", False),
    "gpt-4-turbo-2024-04-09": ("openai/gpt-4-turbo", False),
    "gpt-4.1-2025-04-14": ("openai/gpt-4.1", False),
    "gpt-4.1-mini-2025-04-14": ("openai/gpt-4.1-mini", False),
    "gpt-4.1-nano-2025-04-14": ("openai/gpt-4.1-nano", False),
    "gpt-4o-2024-05-13": ("openai/gpt-4o-2024-05-13", False),
    "gpt-4o-2024-08-06": ("openai/gpt-4o", False),
    "gpt-4o-mini-2024-07-18": ("openai/gpt-4o-mini", False),
    "gpt-5-chat": ("openai/gpt-5-chat", False),
    "gpt-5-high": ("openai/gpt-5", True),
    "gpt-5-mini-high": ("openai/gpt-5-mini", True),
    "gpt-5-nano-high": ("openai/gpt-5-nano", True),
    "gpt-5.1": ("openai/gpt-5.1", False),
    "gpt-5.1-high": ("openai/gpt-5.1", True),
    "gpt-5.2": ("openai/gpt-5.2", False),
    "gpt-5.2-high": ("openai/gpt-5.2", True),
    "gpt-5.2-chat-latest-20260210": ("openai/gpt-5.2-chat", False),
    "gpt-5.3-chat-latest": ("openai/gpt-5.3-chat", False),
    "gpt-5.4": ("openai/gpt-5.4", False),
    "gpt-5.4-high": ("openai/gpt-5.4", True),
    "gpt-5.4-mini-high": ("openai/gpt-5.4-mini", True),
    "gpt-5.4-nano-high": ("openai/gpt-5.4-nano", True),
    "gpt-5.5": ("openai/gpt-5.5", True),
    "gpt-5.5-instant": ("openai/gpt-5.5", False),
    "gpt-5.6-sol-xhigh": ("openai/gpt-5.6-sol", True),
    "gpt-oss-120b": ("openai/gpt-oss-120b", True),
    "gpt-oss-20b": ("openai/gpt-oss-20b", True),
    "o1-2024-12-17": ("openai/o1", True),
    "o1-mini": ("openai/o1-mini", True),
    "o1-preview": ("openai/o1-preview", True),
    "o3-2025-04-16": ("openai/o3", True),
    "o3-mini": ("openai/o3-mini", True),
    "o3-mini-high": ("openai/o3-mini-high", True),
    "o4-mini-2025-04-16": ("openai/o4-mini", True),
    # xAI Grok
    "grok-3-preview-02-24": ("x-ai/grok-3", False),
    "grok-3-mini-high": ("x-ai/grok-3-mini", True),
    "grok-3-mini-beta": ("x-ai/grok-3-mini-beta", True),
    "grok-4-0709": ("x-ai/grok-4", True),  # always reasoning
    "grok-4-fast-chat": ("x-ai/grok-4-fast", False),
    "grok-4-fast-reasoning": ("x-ai/grok-4-fast", True),
    "grok-4-1-fast-reasoning": ("x-ai/grok-4.1-fast", True),
    "grok-4.20-beta1": ("x-ai/grok-4.20", False),
    "grok-4.20-beta-0309-reasoning": ("x-ai/grok-4.20", True),
    "grok-4.20-multi-agent-beta-0309": ("x-ai/grok-4.20-multi-agent", True),
    "grok-4.3": ("x-ai/grok-4.3", True),
    "grok-4.5": ("x-ai/grok-4.5", True),
    # Hy
    "hunyuan-hy3-preview": ("tencent/hy3-preview", True),
    # Moonshot Kimi
    "kimi-k2-0711-preview": ("moonshotai/kimi-k2", False),
    "kimi-k2-0905-preview": ("moonshotai/kimi-k2-0905", False),
    "kimi-k2-thinking-turbo": ("moonshotai/kimi-k2-thinking", True),
    "kimi-k2.5-instant": ("moonshotai/kimi-k2.5", False),
    "kimi-k2.5-thinking": ("moonshotai/kimi-k2.5", True),
    "kimi-k2.6": ("moonshotai/kimi-k2.6", True),
    "kimi-k3": ("moonshotai/kimi-k3", True),
    # Meta Llama
    "llama-3-8b-instruct": ("meta-llama/llama-3-8b-instruct", False),
    "llama-3-70b-instruct": ("meta-llama/llama-3-70b-instruct", False),
    "llama-3.1-8b-instruct": ("meta-llama/llama-3.1-8b-instruct", False),
    "llama-3.1-70b-instruct": ("meta-llama/llama-3.1-70b-instruct", False),
    "llama-3.1-405b-instruct-fp8": ("meta-llama/llama-3.1-405b-instruct", False),
    "llama-3.2-1b-instruct": ("meta-llama/llama-3.2-1b-instruct", False),
    "llama-3.2-3b-instruct": ("meta-llama/llama-3.2-3b-instruct", False),
    "llama-3.3-70b-instruct": ("meta-llama/llama-3.3-70b-instruct", False),
    "llama-4-scout-17b-16e-instruct": ("meta-llama/llama-4-scout", False),
    "llama-4-maverick-17b-128e-instruct": ("meta-llama/llama-4-maverick", False),
    # Nvidia
    "llama-3.1-nemotron-70b-instruct": (
        "nvidia/llama-3.1-nemotron-70b-instruct",
        False,
    ),
    "nvidia-llama-3.3-nemotron-super-49b-v1.5": (
        "nvidia/llama-3.3-nemotron-super-49b-v1.5",
        True,
    ),
    "nvidia-nemotron-3-nano-30b-a3b-bf16": ("nvidia/nemotron-3-nano-30b-a3b", True),
    "nvidia-nemotron-3-super-120b-a12b": ("nvidia/nemotron-3-super-120b-a12b", True),
    "nvidia-nemotron-3-ultra-550b-a55b-nvfp4": (
        "nvidia/nemotron-3-ultra-550b-a55b",
        True,
    ),
    # AllenAI OLMo
    "olmo-3-32b-think": ("allenai/olmo-3-32b-think", True),
    "olmo-3.1-32b-instruct": ("allenai/olmo-3.1-32b-instruct", False),
    # Qwen
    "qwen2.5-72b-instruct": ("qwen/qwen-2.5-72b-instruct", False),
    "qwen2.5-coder-32b-instruct": ("qwen/qwen-2.5-coder-32b-instruct", False),
    "qwen2.5-max": ("qwen/qwen-max", False),
    "qwen3-235b-a22b": ("qwen/qwen3-235b-a22b", True),
    "qwen3-235b-a22b-no-thinking": ("qwen/qwen3-235b-a22b", False),
    "qwen3-235b-a22b-instruct-2507": ("qwen/qwen3-235b-a22b-2507", False),
    "qwen3-235b-a22b-thinking-2507": ("qwen/qwen3-235b-a22b-thinking-2507", True),
    "qwen3-30b-a3b": ("qwen/qwen3-30b-a3b", True),
    "qwen3-30b-a3b-instruct-2507": ("qwen/qwen3-30b-a3b-instruct-2507", False),
    "qwen3-32b": ("qwen/qwen3-32b", True),
    "qwen3-coder-480b-a35b-instruct": ("qwen/qwen3-coder", False),
    "qwen3-max-2025-09-23": ("qwen/qwen3-max", True),
    "qwen3-next-80b-a3b-instruct": ("qwen/qwen3-next-80b-a3b-instruct", False),
    "qwen3-next-80b-a3b-thinking": ("qwen/qwen3-next-80b-a3b-thinking", True),
    "qwen3-vl-235b-a22b-instruct": ("qwen/qwen3-vl-235b-a22b-instruct", False),
    "qwen3-vl-235b-a22b-thinking": ("qwen/qwen3-vl-235b-a22b-thinking", True),
    "qwen3.5-122b-a10b": ("qwen/qwen3.5-122b-a10b", True),
    "qwen3.5-27b": ("qwen/qwen3.5-27b", True),
    "qwen3.5-35b-a3b": ("qwen/qwen3.5-35b-a3b", True),
    "qwen3.5-397b-a17b": ("qwen/qwen3.5-397b-a17b", True),
    "qwen3.5-flash": ("qwen/qwen3.5-flash-02-23", True),
    "qwen3.6-plus": ("qwen/qwen3.6-plus", True),
    "qwen3.6-max-preview": ("qwen/qwen3.6-max-preview", True),
    "qwen3.7-plus": ("qwen/qwen3.7-plus", True),
    "qwen3.7-max-preview": ("qwen/qwen3.7-max", True),
    "qwq-32b": ("qwen/qwq-32b", True),
    # "qwq-32b-preview": ("qwen/qwq-32b", True),  # DUPLICATE
    # Minimax
    "minimax-m1": ("minimax/minimax-m1", True),
    "minimax-m2": ("minimax/minimax-m2", True),
    "minimax-m2.1-preview": ("minimax/minimax-m2.1", True),
    "minimax-m2.5": ("minimax/minimax-m2.5", True),
    "minimax-m2.7": ("minimax/minimax-m2.7", True),
    "minimax-m3": ("minimax/minimax-m3", True),
    # Mistral
    # https://docs.mistral.ai/models/model-cards/mistral-7b-0-1
    "mistral-7b-instruct": ("mistralai/mistral-7b-instruct-v0.1", False),
    # https://docs.mistral.ai/models/model-cards/mistral-large-2-0-24-07
    "mistral-large-2407": ("mistralai/mistral-large-2407", False),
    # https://docs.mistral.ai/models/model-cards/mistral-large-2-1-24-11
    "mistral-large-2411": ("mistralai/mistral-large-2411", False),
    # https://docs.mistral.ai/models/model-cards/mistral-large-3-25-12
    "mistral-large-3": ("mistralai/mistral-large", False),
    # https://docs.mistral.ai/models/model-cards/mistral-medium-3-25-05
    "mistral-medium-2505": ("mistralai/mistral-medium-3", False),
    # https://docs.mistral.ai/models/model-cards/mistral-medium-3-1-25-08
    "mistral-medium-2508": ("mistralai/mistral-medium-3.1", False),
    # https://docs.mistral.ai/models/model-cards/mistral-medium-3-5-26-04
    "mistral-medium-3.5": ("mistralai/mistral-medium-3-5", True),
    # https://docs.mistral.ai/models/model-cards/mistral-small-3-2-25-06
    "mistral-small-2506": ("mistralai/mistral-small-3.2-24b-instruct", False),
    # https://docs.mistral.ai/models/model-cards/mistral-small-3-0-25-01
    "mistral-small-24b-instruct-2501": (
        "mistralai/mistral-small-24b-instruct-2501",
        False,
    ),
    # https://docs.mistral.ai/models/model-cards/mistral-small-3-1-25-03
    "mistral-small-3.1-24b-instruct-2503": (
        "mistralai/mistral-small-3.1-24b-instruct",
        False,
    ),
    # https://docs.mistral.ai/models/model-cards/mixtral-8x7b-0-1
    "mixtral-8x7b-instruct-v0.1": ("mistralai/mixtral-8x7b-instruct", False),
    # https://docs.mistral.ai/models/model-cards/mixtral-8x22b-0-1-0-3
    "mixtral-8x22b-instruct-v0.1": ("mistralai/mixtral-8x22b-instruct", False),
    # Others
    "jamba-1.5-large": ("ai21/jamba-large-1.7", False),
    "mercury-2": ("inception/mercury-2", False),
    "mimo-v2-flash (non-thinking)": ("xiaomi/mimo-v2-flash", False),
    "mimo-v2-flash (thinking)": ("xiaomi/mimo-v2-flash", True),
    "mimo-v2-pro": ("xiaomi/mimo-v2-pro", True),
    "mimo-v2.5": ("xiaomi/mimo-v2.5", True),
    "mimo-v2.5-pro": ("xiaomi/mimo-v2.5-pro", True),
    "phi-4": ("microsoft/phi-4", False),
    "step-3.5-flash": ("stepfun/step-3.5-flash", True),
    "trinity-large-preview": ("arcee-ai/trinity-large-preview", False),
    "trinity-large-thinking": ("arcee-ai/trinity-large-thinking", True),
    "intellect-3": ("prime-intellect/intellect-3", False),
    "granite-4.1-8b": ("ibm-granite/granite-4.1-8b", False),
    "muse-spark-1.1": ("meta/muse-spark-1.1", True),
    "inkling": ("thinkingmachines/inkling", True),
}

os.makedirs("data", exist_ok=True)

ds = load_dataset(
    "lmarena-ai/leaderboard-dataset",
    "text_style_control",
    split="latest",
)

# Group ratings by OR ID
by_id: dict[str, dict[str, list[float]]] = {}
unmapped: list[str] = []

arena_names = set()
for row in ds:
    if row["category"] != "overall":
        continue
    name = row["model_name"]
    arena_names.add(name)
    entry = ARENA_TO_OR.get(name)
    if not entry:
        if name not in unmapped:
            unmapped.append(name)
        continue

    or_id, is_thinking = entry
    if or_id not in by_id:
        by_id[or_id] = {"direct": [], "thinking": []}

    key = "thinking" if is_thinking else "direct"
    bucket = by_id[or_id][key]
    if bucket:
        raise ValueError(
            f"Duplicate rating for {or_id} ({key}): "
            f"already have {bucket[0]} from a different arena name, "
            f"now got {row['rating']} from {name!r}"
        )
    bucket.append(row["rating"])

unused = [k for k in ARENA_TO_OR if k not in arena_names]
if unused:
    raise ValueError(f"Unused mappings ({len(unused)}): " + ", ".join(sorted(unused)))

# Output: Record<or_id, {elo_direct, elo_thinking}>
elos: dict[str, dict] = {}
for or_id, ratings in sorted(by_id.items()):
    elos[or_id] = {
        "elo_direct": max(ratings["direct"]) if ratings["direct"] else None,
        "elo_thinking": max(ratings["thinking"]) if ratings["thinking"] else None,
    }

with open("data/arena.json", "w") as f:
    json.dump(elos, f, indent=2)

print(f"Wrote {len(elos)} model elos to data/arena.json")
if unmapped:
    print(f"Unmapped arena names ({len(unmapped)}):")
    for name in sorted(unmapped):
        print(f"  {name}")
