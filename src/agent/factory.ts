import { registry, type ProviderId } from "./registry.js";
import type { Provider } from "./types.js";
import { OpenAICompatibleLLM } from "./openaiCompatibleProvider.js";
export function createProvider(id: ProviderId): Provider {
  const config = registry[id];
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey)
    throw new Error(`${config.apiKeyEnv} does not exist in .env file`);
  switch (config.kind) {
    case "openai-compatible":
      return new OpenAICompatibleLLM(id, config, apiKey);
  }
}
