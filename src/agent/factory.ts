import { OpenAICompatibleLLM } from "./providers/openaiCompatibleProvider.js";
import { registry, type ProviderId } from "./registry.js";
import type { Provider, ProviderConfig } from "./types.js";
export function createProvider(id: ProviderId): Provider {
  const config: ProviderConfig = registry[id];
  const apiKey = config.apiKeyEnv ? process.env[config.apiKeyEnv] : "ollama";
  if (!apiKey)
    throw new Error(`${config.apiKeyEnv} does not exist in .env file`);
  switch (config.kind) {
    case "openai-compatible":
      return new OpenAICompatibleLLM(id, config, apiKey);
    default:
      throw new Error(`Unsupported provider kind: ${config.kind}`);
  }
}
