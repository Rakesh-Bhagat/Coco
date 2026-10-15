import type { ProviderId } from "./registry.js";

export type Message = {
  role: "assistant" | "user" | "system";
  content: string;
};

export type Conversation = Message[];
export type LLMRequest = {
  messages: Conversation;
  model: string;
  maxTokens?: number;
};

export type Usage = { inputTokens: number; outputTokens: number };
export type LLMResponse = {
  text: string;
  usage?: Usage;
  stopReason?: string | undefined;
};

export type Model = {
  id: string;
  displayName: string;
};

export interface ProviderConfig {
  displayName: string;
  baseURL: string;
  apiKeyEnv: string;
  defaultModel: string;
  kind: "openai-compatible" | "anthropic";
}

export interface Provider {
  id: ProviderId;
  displayName: string;
  listModels: () => Promise<Model[]>;
  getResponse: (request: LLMRequest) => Promise<LLMResponse>;
}
