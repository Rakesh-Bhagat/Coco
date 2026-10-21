import type { ProviderId } from "./registry.js";

export type JSONSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export type ContentBlock =
  | { type: "text"; content: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: unknown;
      extra?: unknown;
    }
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
  /** true = always ask. A function decides per call. Omit for safe tools. */
  requiresApproval?: boolean | ((input: I) => boolean);
  /** One-line summary shown when the tool is called, e.g. the path or command. */
  title?: (input: I) => string;
  /** Extra detail shown in the approval prompt (e.g. a diff). Omit if the title already says it all. Throwing skips the prompt and is reported to the model. */
  describeCall?: (input: I) => string | Promise<string>;
  execute: (input: I, signal?: AbortSignal) => Promise<string>;
};

export type ApprovalDecision = "yes" | "no" | "always";
export type ApprovalHandler = (req: {
  tool: string;
  label: string;
  summary: string;
  signal?: AbortSignal | undefined;
}) => Promise<ApprovalDecision>;

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
  signal?: AbortSignal | undefined;
};

export type LLMResponse = {
  text: string;
  toolCalls?: { id: string; name: string; input: unknown; extra?: unknown }[];
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
  apiKeyEnv?: string;
  defaultModel: string;
  kind: "openai-compatible" | "anthropic";
  headers?: Record<string, string>;
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
  run: (input: string, signal?: AbortSignal) => Promise<void>;
  getModel: () => Promise<Model[]>;
  setModel: (model: Model) => Promise<void>;
  setProvider: (provider: ProviderId) => void;
}
