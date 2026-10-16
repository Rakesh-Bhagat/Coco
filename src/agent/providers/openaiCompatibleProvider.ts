import OpenAI from "openai";
import type {
  LLMRequest,
  LLMResponse,
  Model,
  Provider,
  ProviderConfig,
  StreamEvent,
  Usage,
} from "../types.js";
import type { ProviderId } from "../registry.js";
import { mapStopReason } from "../utils/mapStopReason.js";
import { toOpenAIMessages } from "../utils/toOpenAIMessages.js";

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
      messages: toOpenAIMessages(request.messages),
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
      stopReason: mapStopReason(response.choices[0]?.finish_reason),
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
  async *getStreamResponse(request: LLMRequest): AsyncGenerator<StreamEvent> {
    const stream = await this.client.chat.completions.create({
      messages: toOpenAIMessages(request.messages),
      stream: true,
      model: request.model,
      stream_options: { include_usage: true },
      ...(request.maxTokens !== undefined && {
        max_completion_tokens: request.maxTokens,
      }),
    });
    let fullText = "";
    let finishReason: string | null | undefined;
    let usageCost: Usage | undefined;
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta.content;
      if (typeof content === "string") {
        fullText += content;
        yield { type: "text_delta", text: content };
      }
      if (chunk.usage) {
        usageCost = {
          inputTokens: chunk.usage.prompt_tokens ?? 0,
          outputTokens: chunk.usage.completion_tokens ?? 0,
        };
      }
      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0]?.finish_reason;
      }
    }
    yield {
      type: "done",
      response: {
        text: fullText,
        ...(usageCost && { usage: usageCost }),
        stopReason: mapStopReason(finishReason),
      },
    };
  }
}
