import OpenAI from "openai";
import { type ProviderId } from "./registry.js";
import type {
  LLMRequest,
  LLMResponse,
  Model,
  Provider,
  ProviderConfig,
} from "./types.js";

export class OpenAICompatibleLLM implements Provider {
  id: ProviderId;
  displayName: string;
  client: OpenAI;
  constructor(id: ProviderId, config: ProviderConfig, apiKey: string) {
    this.id = id;
    this.displayName = config.displayName;
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: apiKey,
    });
  }
  async getResponse(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      messages: request.messages,
      model: request.model,
      ...(request.maxTokens !== undefined && {
        max_completion_tokens: request.maxTokens,
      }),
    });
    const output = {
      text: response.choices[0]?.message.content || "",
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
      },
      stopReason: response.choices[0]?.finish_reason ?? undefined,
    };
    return output;
  }
  async listModels(): Promise<Model[]> {
    const res = await this.client.models.list();
    const models = res.data.map((model) => ({
      id: model.id,
      displayName: model.id,
    }));
    return models;
  }
}
