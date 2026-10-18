import type { ProviderId } from "./registry.js";

export type JSONSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export type ContentBlock =
  | { type: "text"; content: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; toolCallId: string; output: unknown };

export type Message = {
  role: "assistant" | "user" | "tool";
  content: ContentBlock[];
};

export type Tool<I = unknown> = {
  name: string;
  label: string;
  description: string;
  input: JSONSchema;
  execute: (input: I) => Promise<string>;
};

export type ToolDefinition = Pick<Tool, "name" | "description" | "input">;

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "done"; response: LLMResponse };

export type Usage = { inputTokens: number; outputTokens: number };
export type Conversation = Message[];

export type LLMRequest = {
  messages: Conversation;
  model: string;
  system?: string;
  maxTokens?: number;
  tools?: ToolDefinition[];
};

export type LLMResponse = {
  text: string;
  toolCalls?: { id: string; name: string; input: unknown }[];
  usage?: Usage;
  stopReason?: "end" | "tool_use" | "max_tokens" | "other" | undefined;
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
  getStreamResponse: (request: LLMRequest) => AsyncIterable<StreamEvent>;
}

export interface AgentInterface {
  id: ProviderId;
  client: Provider;
  model: Model;
  run: (input: string) => Promise<void>;
  getModel: () => Promise<Model[]>;
  setModel: (model: Model) => Promise<void>;
  setProvider: (provider: ProviderId) => void;
}
