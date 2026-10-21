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
import { toOpenAITool } from "../utils/toOpenAITool.js";

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
      ...(config.headers && { defaultHeaders: config.headers }),
    });
  }
  async getResponse(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      messages: toOpenAIMessages(request.messages, request.system),
      model: request.model,
      ...(request.maxTokens !== undefined && {
        max_completion_tokens: request.maxTokens,
      }),
      ...toOpenAITool(request.tools),
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
    const stream = await this.client.chat.completions.create(
      {
        messages: toOpenAIMessages(request.messages, request.system),
        stream: true,
        model: request.model,
        stream_options: { include_usage: true },
        ...(request.maxTokens !== undefined && {
          max_completion_tokens: request.maxTokens,
        }),
        ...toOpenAITool(request.tools),
      },
      // aborting the signal closes the HTTP stream, so the loop below throws
      { signal: request.signal },
    );
    let fullText = "";
    let finishReason: string | null | undefined;
    let usageCost: Usage | undefined;
    const pending = new Map<
      number,
      { id: string; name: string; args: string; extra?: unknown }
    >();
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta.content;
      if (typeof content === "string") {
        fullText += content;
        yield { type: "text_delta", text: content };
      }
      for (const tc of chunk.choices[0]?.delta.tool_calls ?? []) {
        const cur = pending.get(tc.index) ?? { id: "", name: "", args: "" };
        if (tc.id) {
          cur.id = tc.id;
        }
        if (tc.function?.name) {
          cur.name = tc.function.name;
        }
        if (tc.function?.arguments) {
          cur.args += tc.function.arguments;
        }
        const extra = (tc as { extra_content?: unknown }).extra_content;
        if (extra !== undefined) {
          cur.extra = extra;
        }
        pending.set(tc.index, cur);
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
    const toolCalls = [...pending.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, c]) => {
        let input: unknown = {};
        try {
          input = c.args.trim() ? JSON.parse(c.args) : {};
        } catch {
          input = { __parseError: c.args };
        }
        return {
          id: c.id,
          name: c.name,
          input,
          ...(c.extra !== undefined && { extra: c.extra }),
        };
      });

    yield {
      type: "done",
      response: {
        text: fullText,
        ...(usageCost && { usage: usageCost }),
        ...(toolCalls.length > 0 && { toolCalls }),
        stopReason:
          toolCalls.length > 0 ? "tool_use" : mapStopReason(finishReason),
      },
    };
  }
}
