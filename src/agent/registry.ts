import type { ProviderConfig } from "./types.js";

export const registry = {
  groq: {
    displayName: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKeyEnv: "GROQ_API_KEY",
    kind: "openai-compatible",
    defaultModel: "qwen/qwen3.8-27b",
  },
  anthropic: {
    displayName: "anthropic",
    baseURL: "https://api.anthropic.com/v1/",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    kind: "openai-compatible",
    defaultModel: "claude-haiku-5-5",
  },
} satisfies Record<string, ProviderConfig>;

export type ProviderId = keyof typeof registry;
