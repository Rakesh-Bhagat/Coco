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
    headers: { "anthropic-version": "2023-06-01" },
  },
  ollama: {
    displayName: "Ollama",
    baseURL: "http://localhost:11434/v1",
    kind: "openai-compatible",
    defaultModel: "qwen3:4b",
  },
  openai: {
    displayName: "Openai",
    baseURL: "https://api.openai.com/v1",
    kind: "openai-compatible",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultModel: "gpt-6-luna",
  },
  gemini: {
    displayName: "Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    kind: "openai-compatible",
    defaultModel: "gemini-3.1-flash-lite",
    apiKeyEnv: "GEMINI_API_KEY",
  },
} satisfies Record<string, ProviderConfig>;

export type ProviderId = keyof typeof registry;
