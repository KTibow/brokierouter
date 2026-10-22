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
    "Amazon Nova Lite 1.0": ("amazon/nova-lite-v1", False),
    "Amazon Nova Micro 1.0": ("amazon/nova-micro-v1", False),
    "Amazon Nova Pro 1.0": ("amazon/nova-pro-v1", False),
    "Amazon Nova 2 Lite": ("amazon/nova-2-lite-v1", False),
    # Anthropic Claude 3 / 3.5 / 3.7
    "Claude 3 Haiku (20240307)": ("anthropic/claude-3-haiku", False),
    "Claude 3.5 Haiku (20241022)": ("anthropic/claude-3.5-haiku", False),
    "Claude 3.7 Sonnet (20250219)": ("anthropic/claude-3.7-sonnet", False),
    "Claude 3.7 Sonnet (Thinking 32K, 20250219)": (
        "anthropic/claude-3.7-sonnet",
        True,
    ),
    # Claude 4 family
    "Claude Haiku 4.5 (20251001)": ("anthropic/claude-haiku-4.5", False),
    "Claude Opus 4 (20250514)": ("anthropic/claude-opus-4", False),
    "Claude Opus 4 (Thinking 16K, 20250514)": ("anthropic/claude-opus-4", True),
    "Claude Opus 4.1 (20250805)": ("anthropic/claude-opus-4.1", False),
    "Claude Opus 4.1 (Thinking 16K, 20250805)": ("anthropic/claude-opus-4.1", True),
    "Claude Opus 4.5 (20251101)": ("anthropic/claude-opus-4.5", False),
    "Claude Opus 4.5 (High, 32K, 20251101)": ("anthropic/claude-opus-4.5", True),
    "Claude Opus 4.6": ("anthropic/claude-opus-4.6", False),
    "Claude Opus 4.6 (High)": ("anthropic/claude-opus-4.6", True),
    "Claude Opus 4.7": ("anthropic/claude-opus-4.7", False),
    "Claude Opus 4.7 (High)": ("anthropic/claude-opus-4.7", True),
    "Claude Opus 4.8": ("anthropic/claude-opus-4.8", False),
    "Claude Opus 4.8 (High)": ("anthropic/claude-opus-4.8", True),
    "Claude Opus 5 (High)": ("anthropic/claude-opus-5", True),
    "Claude Opus 5.5 (High)": ("anthropic/claude-opus-5.5", True),
    "Claude Sonnet 4 (20250514)": ("anthropic/claude-sonnet-4", False),
    "Claude Sonnet 4 (Thinking 32K, 20250514)": ("anthropic/claude-sonnet-4", True),
    "Claude Sonnet 4.5 (20250929)": ("anthropic/claude-sonnet-4.5", False),
    "Claude Sonnet 4.5 (High, 32K, 20250929)": ("anthropic/claude-sonnet-4.5", True),
    "Claude Sonnet 4.6": ("anthropic/claude-sonnet-4.6", False),
    "Claude Sonnet 5 (High)": ("anthropic/claude-sonnet-5", True),
    "Claude Sonnet 5.5 (xHigh)": ("anthropic/claude-sonnet-5.5", True),
    "Claude Fable 5 (High)": ("anthropic/claude-fable-5", True),
    "Claude Fable 5.1 (Max)": ("anthropic/claude-fable-5.1", True),
    # Cohere
    "Command A (03-2025)": ("cohere/command-a", False),
    "Command R (08-2024)": ("cohere/command-r-08-2024", False),
    # "command-r": ("cohere/command-r-08-2024", False),  # DUPLICATE of command-r-08-2024
    "Command R+ (08-2024)": ("cohere/command-r-plus-08-2024", False),
    # "command-r-plus": ("cohere/command-r-plus-08-2024", False),  # DUPLICATE
    # DeepSeek
    "DeepSeek-R1": ("deepseek/deepseek-r1", True),  # always-on reasoning
    "DeepSeek-R1 (0528)": ("deepseek/deepseek-r1-0528", True),
    "DeepSeek-V3": ("deepseek/deepseek-chat", False),
    "DeepSeek-V3 (0324)": ("deepseek/deepseek-chat-v3-0324", False),
    # hybrids
    "DeepSeek-V3.1": ("deepseek/deepseek-chat-v3.1", False),
    "DeepSeek-V3.1 (Thinking)": ("deepseek/deepseek-chat-v3.1", True),
    "DeepSeek-V3.1-Terminus": ("deepseek/deepseek-v3.1-terminus", False),
    "DeepSeek-V3.1-Terminus (Thinking)": ("deepseek/deepseek-v3.1-terminus", True),
    "DeepSeek-V3.2": ("deepseek/deepseek-v3.2", False),
    "DeepSeek-V3.2 (Thinking)": ("deepseek/deepseek-v3.2", True),
    "DeepSeek-V3.2-Exp": ("deepseek/deepseek-v3.2-exp", False),
    "DeepSeek-V3.2-Exp (Thinking)": ("deepseek/deepseek-v3.2-exp", True),
    "DeepSeek-V4-Pro": ("deepseek/deepseek-v4-pro", False),
    "DeepSeek-V4-Pro Preview (High)": ("deepseek/deepseek-v4-pro", True),
    "DeepSeek-V4-Pro (High, 20260813)": ("deepseek/deepseek-v4-pro-0813", True),
    "DeepSeek-V4-Flash": ("deepseek/deepseek-v4-flash", False),
    "DeepSeek-V4-Flash Preview (High)": ("deepseek/deepseek-v4-flash", True),
    "DeepSeek-V4.1-Flash-20260910 (Max)": ("deepseek/deepseek-v4.1-flash", True),
    # Google Gemini
    "Gemini 2.0 Flash (001)": ("google/gemini-2.0-flash-001", False),
    "Gemini 2.5 Flash": ("google/gemini-2.5-flash", False),
    "Gemini 2.5 Flash-Lite Preview (Thinking, 06-17)": (
        "google/gemini-2.5-flash-lite",
        True,
    ),
    "Gemini 2.5 Flash-Lite Preview (Non-Thinking, 09-2025)": (
        "google/gemini-2.5-flash-lite-preview-09-2025",
        False,
    ),
    "Gemini 2.5 Pro": ("google/gemini-2.5-pro", True),  # adaptive thinking
    "Gemini 3 Flash": ("google/gemini-3-flash-preview", True),
    "Gemini 3 Flash (Minimal)": ("google/gemini-3-flash-preview", False),
    "Gemini 3.1 Flash-Lite Preview": ("google/gemini-3.1-flash-lite", False),
    "Gemini 3.1 Pro Preview": ("google/gemini-3.1-pro-preview", True),
    "Gemini 3.5 Flash (Medium)": ("google/gemini-3.5-flash", True),
    "Gemini 3.5 Flash-Lite": ("google/gemini-3.5-flash-lite", True),
    "Gemini 3.6 Flash (High)": ("google/gemini-3.6-flash", True),
    "Gemini 3.7 Flash (High)": ("google/gemini-3.7-flash", True),
    "Gemini 3.8 Flash (High)": ("google/gemini-3.8-flash", True),
    "Gemini 4 Argon (High)": ("google/gemini-4-argon", True),
    # Google Gemma
    "Gemma 2 27B IT": ("google/gemma-2-27b-it", False),
    "Gemma 3 12B IT": ("google/gemma-3-12b-it", False),
    "Gemma 3 27B IT": ("google/gemma-3-27b-it", False),
    "Gemma 3 4B IT": ("google/gemma-3-4b-it", False),
    "Gemma 3n E4B IT": ("google/gemma-3n-e4b-it", False),
    "Gemma 4 26B A4B": ("google/gemma-4-26b-a4b-it", True),
    "Gemma 4 31B": ("google/gemma-4-31b-it", True),
    # Z.ai GLM
    "GLM-4.5": ("z-ai/glm-4.5", True),
    "GLM-4.5-Air": ("z-ai/glm-4.5-air", True),
    "GLM-4.5V": ("z-ai/glm-4.5v", True),
    "GLM-4.6": ("z-ai/glm-4.6", True),
    "GLM-4.6V": ("z-ai/glm-4.6v", True),
    "GLM-4.7": ("z-ai/glm-4.7", True),
    "GLM-4.7-Flash": ("z-ai/glm-4.7-flash", True),
    "GLM-5": ("z-ai/glm-5", True),
    "GLM-5.1": ("z-ai/glm-5.1", True),
    "GLM-5.2 (Max)": ("z-ai/glm-5.2", True),
    "GLM-5.3-Flash": ("z-ai/glm-5.3-flash", True),
    "GLM-5.3 (Max)": ("z-ai/glm-5.3", True),
    "GLM-5V-Turbo": ("z-ai/glm-5v-turbo", True),
    # OpenAI GPT / o-series
    "GPT-3.5 Turbo (0125)": ("openai/gpt-3.5-turbo", False),
    "GPT-4 (0314)": ("openai/gpt-4-0314", False),
    "GPT-4 (0613)": ("openai/gpt-4", False),
    "GPT-4 Turbo Preview (1106)": ("openai/gpt-4-1106-preview", False),
    "GPT-4 Turbo (2024-04-09)": ("openai/gpt-4-turbo", False),
    "GPT-4.1 (2025-04-14)": ("openai/gpt-4.1", False),
    "GPT-4.1 mini (2025-04-14)": ("openai/gpt-4.1-mini", False),
    "GPT-4.1 nano (2025-04-14)": ("openai/gpt-4.1-nano", False),
    "GPT-4o (2024-05-13)": ("openai/gpt-4o-2024-05-13", False),
    "GPT-4o (2024-08-06)": ("openai/gpt-4o", False),
    "GPT-4o mini (2024-07-18)": ("openai/gpt-4o-mini", False),
    "GPT-5 Chat": ("openai/gpt-5-chat", False),
    "GPT-5 (High)": ("openai/gpt-5", True),
    "GPT-5 mini (High)": ("openai/gpt-5-mini", True),
    "GPT-5 nano (High)": ("openai/gpt-5-nano", True),
    "GPT-5.1": ("openai/gpt-5.1", False),
    "GPT-5.1 (High)": ("openai/gpt-5.1", True),
    "GPT-5.2": ("openai/gpt-5.2", False),
    "GPT-5.2 (High)": ("openai/gpt-5.2", True),
    "GPT-5.2 Chat (20260210)": ("openai/gpt-5.2-chat", False),
    "GPT-5.3 Chat": ("openai/gpt-5.3-chat", False),
    "GPT-5.4": ("openai/gpt-5.4", False),
    "GPT-5.4 (High)": ("openai/gpt-5.4", True),
    "GPT-5.4 mini (High)": ("openai/gpt-5.4-mini", True),
    "GPT-5.4 nano (High)": ("openai/gpt-5.4-nano", True),
    "GPT-5.5": ("openai/gpt-5.5", True),
    "GPT-5.5 Instant": ("openai/gpt-5.5", False),
    "GPT-5.6 Sol (xHigh)": ("openai/gpt-5.6-sol", True),
    "GPT-5.6 Terra (xHigh)": ("openai/gpt-5.6-terra", True),
    "GPT-5.6 Luna (xHigh)": ("openai/gpt-5.6-luna", True),
    "GPT-6 Sol (Max)": ("openai/gpt-6-sol", True),
    "GPT-6 Astra (Max)": ("openai/gpt-6-astra", True),
    "GPT-6 Luna (Max)": ("openai/gpt-6-luna", True),
    "GPT-6.1 Sol (Max)": ("openai/gpt-6.1-sol", True),
    "gpt-oss-120b": ("openai/gpt-oss-120b", True),
    "gpt-oss-20b": ("openai/gpt-oss-20b", True),
    "o1 (2024-12-17)": ("openai/o1", True),
    "o1-mini": ("openai/o1-mini", True),
    "o1-preview": ("openai/o1-preview", True),
    "o3 (2025-04-16)": ("openai/o3", True),
    "o3-mini": ("openai/o3-mini", True),
    "o3-mini (High)": ("openai/o3-mini-high", True),
    "o4-mini (2025-04-16)": ("openai/o4-mini", True),
    # xAI Grok
    "Grok 3 Preview (02-24)": ("x-ai/grok-3", False),
    "Grok 3 Mini (High)": ("x-ai/grok-3-mini", True),
    "Grok 3 Mini Beta": ("x-ai/grok-3-mini-beta", True),
    "Grok 4 (0709)": ("x-ai/grok-4", True),  # always reasoning
    "Grok 4 Fast (Non-Reasoning)": ("x-ai/grok-4-fast", False),
    "Grok 4 Fast (Reasoning)": ("x-ai/grok-4-fast", True),
    "Grok 4.1 Fast (Reasoning)": ("x-ai/grok-4.1-fast", True),
    "Grok 4.20 Beta 1": ("x-ai/grok-4.20", False),
    "Grok 4.20 Beta (Reasoning, 0309)": ("x-ai/grok-4.20", True),
    "Grok 4.20 Multi-Agent Beta (0309)": ("x-ai/grok-4.20-multi-agent", True),
    "Grok 4.3": ("x-ai/grok-4.3", True),
    "Grok 4.5": ("x-ai/grok-4.5", True),
    "Grok 4.6 (High)": ("x-ai/grok-4.6", True),
    "Grok 4.7 (xHigh)": ("x-ai/grok-4.7", True),
    # Hy
    "Hy3 preview": ("tencent/hy3-preview", True),
    "Hy3": ("tencent/hy3", True),
    # Moonshot Kimi
    "Kimi K2 Preview (0711)": ("moonshotai/kimi-k2", False),
    "Kimi K2 Preview (0905)": ("moonshotai/kimi-k2-0905", False),
    "Kimi K2 Thinking Turbo": ("moonshotai/kimi-k2-thinking", True),
    "Kimi K2.5 (Instant)": ("moonshotai/kimi-k2.5", False),
    "Kimi K2.5 (Thinking)": ("moonshotai/kimi-k2.5", True),
    "Kimi K2.6": ("moonshotai/kimi-k2.6", True),
    "Kimi K3 (Max)": ("moonshotai/kimi-k3", True),
    # Meta Llama
    "Llama 3 8B Instruct": ("meta-llama/llama-3-8b-instruct", False),
    "Llama 3 70B Instruct": ("meta-llama/llama-3-70b-instruct", False),
    "Llama 3.1 8B Instruct": ("meta-llama/llama-3.1-8b-instruct", False),
    "Llama 3.1 70B Instruct": ("meta-llama/llama-3.1-70b-instruct", False),
    "Llama 3.1 405B Instruct (FP8)": ("meta-llama/llama-3.1-405b-instruct", False),
    "Llama 3.2 1B Instruct": ("meta-llama/llama-3.2-1b-instruct", False),
    "Llama 3.2 3B Instruct": ("meta-llama/llama-3.2-3b-instruct", False),
    "Llama 3.3 70B Instruct": ("meta-llama/llama-3.3-70b-instruct", False),
    "Llama 4 Scout 17B 16E Instruct": ("meta-llama/llama-4-scout", False),
    "Llama 4 Maverick 17B 128E Instruct": ("meta-llama/llama-4-maverick", False),
    # Nvidia
    "Llama 3.1 Nemotron 70B Instruct": (
        "nvidia/llama-3.1-nemotron-70b-instruct",
        False,
    ),
    "Llama 3.3 Nemotron Super 49B v1.5": (
        "nvidia/llama-3.3-nemotron-super-49b-v1.5",
        True,
    ),
    "NVIDIA-Nemotron-3-Nano-30B-A3B (BF16)": ("nvidia/nemotron-3-nano-30b-a3b", True),
    "NVIDIA-Nemotron-3-Super-120B-A12B": ("nvidia/nemotron-3-super-120b-a12b", True),
    "NVIDIA-Nemotron-3-Ultra-550B-A55B (NVFP4)": (
        "nvidia/nemotron-3-ultra-550b-a55b",
        True,
    ),
    "NVIDIA-Nemotron-3.5-Lightning-30B-A3B (NVFP4)": (
        "nvidia/nemotron-3.5-lightning",
        True,
    ),
    "NVIDIA-Nemotron-3.5-Super-VL-120B-A12B (NVFP4)": (
        "nvidia/nemotron-3.5-super-vl",
        True,
    ),
    # AllenAI OLMo
    "Olmo 3 32B Think": ("allenai/olmo-3-32b-think", True),
    "Olmo 3.1 32B Instruct": ("allenai/olmo-3.1-32b-instruct", False),
    # Qwen
    "Qwen2.5-72B-Instruct": ("qwen/qwen-2.5-72b-instruct", False),
    "Qwen2.5-Coder-32B-Instruct": ("qwen/qwen-2.5-coder-32b-instruct", False),
    "Qwen2.5-Max": ("qwen/qwen-max", False),
    "Qwen3-235B-A22B": ("qwen/qwen3-235b-a22b", True),
    "Qwen3-235B-A22B (Non-Thinking)": ("qwen/qwen3-235b-a22b", False),
    "Qwen3-235B-A22B-Instruct (2507)": ("qwen/qwen3-235b-a22b-2507", False),
    "Qwen3-235B-A22B-Thinking (2507)": ("qwen/qwen3-235b-a22b-thinking-2507", True),
    "Qwen3-30B-A3B": ("qwen/qwen3-30b-a3b", True),
    "Qwen3-30B-A3B-Instruct (2507)": ("qwen/qwen3-30b-a3b-instruct-2507", False),
    "Qwen3-32B": ("qwen/qwen3-32b", True),
    "Qwen3-Coder-480B-A35B-Instruct": ("qwen/qwen3-coder", False),
    "Qwen3-Max (2025-09-23)": ("qwen/qwen3-max", True),
    "Qwen3-Next-80B-A3B-Instruct": ("qwen/qwen3-next-80b-a3b-instruct", False),
    "Qwen3-Next-80B-A3B-Thinking": ("qwen/qwen3-next-80b-a3b-thinking", True),
    "Qwen3-VL-235B-A22B-Instruct": ("qwen/qwen3-vl-235b-a22b-instruct", False),
    "Qwen3-VL-235B-A22B-Thinking": ("qwen/qwen3-vl-235b-a22b-thinking", True),
    "Qwen3.5-122B-A10B": ("qwen/qwen3.5-122b-a10b", True),
    "Qwen3.5-27B": ("qwen/qwen3.5-27b", True),
    "Qwen3.5-35B-A3B": ("qwen/qwen3.5-35b-a3b", True),
    "Qwen3.5-397B-A17B": ("qwen/qwen3.5-397b-a17b", True),
    "Qwen3.5-Flash": ("qwen/qwen3.5-flash-02-23", True),
    "Qwen3.6-Plus": ("qwen/qwen3.6-plus", True),
    "Qwen3.6-Max-Preview": ("qwen/qwen3.6-max-preview", True),
    "Qwen3.7-Plus": ("qwen/qwen3.7-plus", True),
    "Qwen3.7-Max-Preview": ("qwen/qwen3.7-max", True),
    "Qwen3.8-Max": ("qwen/qwen3.8-max", True),
    "Qwen3.8-27B": ("qwen/qwen3.8-27b", True),
    "QwQ-32B": ("qwen/qwq-32b", True),
    # "qwq-32b-preview": ("qwen/qwq-32b", True),  # DUPLICATE
    # Minimax
    "MiniMax-M1": ("minimax/minimax-m1", True),
    "MiniMax-M2": ("minimax/minimax-m2", True),
    "MiniMax-M2.1 Preview": ("minimax/minimax-m2.1", True),
    "MiniMax-M2.5": ("minimax/minimax-m2.5", True),
    "MiniMax-M2.7": ("minimax/minimax-m2.7", True),
    "MiniMax-M3": ("minimax/minimax-m3", True),
    # Mistral
    # https://docs.mistral.ai/models/model-cards/mistral-7b-0-1
    "Mistral 7B Instruct": ("mistralai/mistral-7b-instruct-v0.1", False),
    # https://docs.mistral.ai/models/model-cards/mistral-large-2-0-24-07
    "Mistral Large 2 (2407)": ("mistralai/mistral-large-2407", False),
    # https://docs.mistral.ai/models/model-cards/mistral-large-2-1-24-11
    "Mistral Large (2411)": ("mistralai/mistral-large-2411", False),
    # https://docs.mistral.ai/models/model-cards/mistral-large-3-25-12
    "Mistral Large 3": ("mistralai/mistral-large", False),
    # https://docs.mistral.ai/models/model-cards/mistral-medium-3-25-05
    "Mistral Medium 3 (2505)": ("mistralai/mistral-medium-3", False),
    # https://docs.mistral.ai/models/model-cards/mistral-medium-3-1-25-08
    "Mistral Medium 3.1 (2508)": ("mistralai/mistral-medium-3.1", False),
    # https://docs.mistral.ai/models/model-cards/mistral-medium-3-5-26-04
    "Mistral Medium 3.5": ("mistralai/mistral-medium-3-5", True),
    # https://docs.mistral.ai/models/model-cards/mistral-small-3-2-25-06
    "Mistral Small 3.2 (2506)": ("mistralai/mistral-small-3.2-24b-instruct", False),
    # https://docs.mistral.ai/models/model-cards/mistral-small-3-0-25-01
    "Mistral Small 24B Instruct (2501)": (
        "mistralai/mistral-small-24b-instruct-2501",
        False,
    ),
    # https://docs.mistral.ai/models/model-cards/mistral-small-3-1-25-03
    "Mistral Small 3.1 24B Instruct (2503)": (
        "mistralai/mistral-small-3.1-24b-instruct",
        False,
    ),
    # https://docs.mistral.ai/models/model-cards/mixtral-8x7b-0-1
    "Mixtral 8x7B Instruct v0.1": ("mistralai/mixtral-8x7b-instruct", False),
    # https://docs.mistral.ai/models/model-cards/mixtral-8x22b-0-1-0-3
    "Mixtral 8x22B Instruct v0.1": ("mistralai/mixtral-8x22b-instruct", False),
    # Others
    "Jamba 1.5 Large": ("ai21/jamba-large-1.7", False),
    "Mercury 2": ("inception/mercury-2", False),
    "MiMo-V2-Flash (Non-Thinking)": ("xiaomi/mimo-v2-flash", False),
    "MiMo-V2-Flash (Thinking)": ("xiaomi/mimo-v2-flash", True),
    "MiMo-V2-Pro": ("xiaomi/mimo-v2-pro", True),
    "MiMo-V2.5": ("xiaomi/mimo-v2.5", True),
    "MiMo-V2.5-Pro": ("xiaomi/mimo-v2.5-pro", True),
    "MiMo-V2.6-Flash": ("xiaomi/mimo-v2.6-flash", True),
    "MiMo-V2.6-Pro": ("xiaomi/mimo-v2.6-pro", True),
    "Phi-4": ("microsoft/phi-4", False),
    "Step-3.5-Flash": ("stepfun/step-3.5-flash", True),
    "Step 5 Preview": ("stepfun/step-5-preview", True),
    "Trinity Large Preview": ("arcee-ai/trinity-large-preview", False),
    "Trinity Large Thinking": ("arcee-ai/trinity-large-thinking", True),
    "INTELLECT-3": ("prime-intellect/intellect-3", False),
    "Solar Pro 4": ("upstage/solar-pro4", True),
    "Granite 4.1 8B": ("ibm-granite/granite-4.1-8b", False),
    "Granite 4.2 8B": ("ibm-granite/granite-4.2-8b", True),
    "Muse Spark 1.1": ("meta/muse-spark-1.1", True),
    "Muse Spark 1.2 (xHigh)": ("meta/muse-spark-1.2", True),
    "Muse Spark 1.3 (Max)": ("meta/muse-spark-1.3", True),
    "Muse Wonder (Max)": ("meta/muse-wonder", True),
    "Muse Glimmer": ("meta/muse-glimmer-30b", True),
    "Inkling": ("thinkingmachines/inkling", True),
    "Inkling-Small": ("thinkingmachines/inkling-small", True),
}

os.makedirs("data", exist_ok=True)

ds = load_dataset(
    "lmarena-ai/leaderboard-dataset",
    "text_style_control",
    split="latest",
)

# Group ratings by OR ID
by_id: dict[str, dict[str, float | None]] = {}
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
        by_id[or_id] = {"direct": None, "thinking": None}

    key = "thinking" if is_thinking else "direct"
    if by_id[or_id][key] is not None:
        raise ValueError(
            f"Duplicate rating for {or_id} ({key}): "
            f"already have {by_id[or_id][key]} from a different arena name, "
            f"now got {row['rating']} from {name!r}"
        )
    by_id[or_id][key] = row["rating"]

unused = [k for k in ARENA_TO_OR if k not in arena_names]
if unused:
    raise ValueError(f"Unused mappings ({len(unused)}): " + ", ".join(sorted(unused)))

# Special case: duplicate the qwen3.8-max score for the 2.4t-a95b variant
# (same model, different OpenRouter slug)
_src = "qwen/qwen3.8-max"
_dst = "qwen/qwen3.8-2.4t-a95b"
by_id[_dst] = dict(by_id[_src])

# Output: Record<or_id, {elo_direct, elo_thinking}>
elos: dict[str, dict] = {}
for or_id, ratings in sorted(by_id.items()):
    elos[or_id] = {
        "elo_direct": ratings["direct"],
        "elo_thinking": ratings["thinking"],
    }

with open("data/arena.json", "w") as f:
    json.dump(elos, f, indent=2)

print(f"Wrote {len(elos)} model elos to data/arena.json")
if unmapped:
    print(f"Unmapped arena names ({len(unmapped)}):")
    for name in sorted(unmapped):
        print(f"  {name}")
