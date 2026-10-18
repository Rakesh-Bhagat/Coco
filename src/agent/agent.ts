import { createProvider } from "./factory.js";
import type {
  AgentInterface,
  ContentBlock,
  Conversation,
  LLMResponse,
  Model,
  Provider,
} from "./types.js";
import { registry, type ProviderId } from "./registry.js";
import { toolMap, tools } from "../tools/index.js";
import { createMarkdownStreamer, render } from "markdansi";
import { renderMarkdown } from "./utils/markdown.js";
const MAX_TURNS = 20;

const toolDefinitions = tools.map(({ name, description, input }) => ({
  name,
  description,
  input,
}));

function createStreamer() {
  return createMarkdownStreamer({
    render: renderMarkdown,
    spacing: "single",
  });
}

export class Agent implements AgentInterface {
  id: ProviderId;
  client: Provider;
  conversation: Conversation;
  model: Model;
  constructor(id: ProviderId, defaultModel: Model) {
    this.conversation = [];
    this.id = id;
    this.client = createProvider(this.id);
    this.model = defaultModel;
  }
  setProvider(provider: ProviderId) {
    this.client = createProvider(provider);
    this.id = this.client.id;
    const defaultModel = registry[provider].defaultModel;
    this.model = { id: defaultModel, displayName: defaultModel };
  }
  async getModel() {
    return await this.client.listModels();
  }
  async setModel(model: Model) {
    const availableModel = await this.getModel();
    if (!availableModel.some((m) => m.id === model.id)) {
      throw new Error(`invalid model`);
    }
    this.model = { id: model.id, displayName: model.displayName };
    return;
  }
  async run(input: string) {
    const startLength = this.conversation.length;
    try {
      this.conversation.push({
        role: "user",
        content: [{ type: "text", content: input }],
      });
      for (let i = 0; i < MAX_TURNS; i++) {
        const stream = this.client.getStreamResponse({
          messages: this.conversation,
          model: this.model.id,
          tools: toolDefinitions,
        });
        let stopReason: LLMResponse["stopReason"];
        let toolCalls: NonNullable<LLMResponse["toolCalls"]> = [];
        const streamer = createStreamer();
        // process.stdout.write("Assistant: ");
        for await (const event of stream) {
          if (event.type === "text_delta") {
            process.stdout.write(streamer.push(event.text));
          }
          if (event.type === "done") {
            process.stdout.write(streamer.finish());
            const blocks: ContentBlock[] = [];
            if (event.response.text) {
              blocks.push({ type: "text", content: event.response.text });
            }
            if (event.response.toolCalls) {
              for (const c of event.response.toolCalls ?? []) {
                blocks.push({
                  type: "tool_use",
                  id: c.id,
                  name: c.name,
                  input: c.input,
                });
              }
            }
            toolCalls = event.response.toolCalls ?? [];
            stopReason = event.response.stopReason;
            if (blocks.length > 0) {
              this.conversation.push({ role: "assistant", content: blocks });
            }
            process.stdout.write("\n");
          }
        }
        if (stopReason !== "tool_use" || toolCalls.length === 0) {
          return;
        }
        const results: ContentBlock[] = [];
        for (const call of toolCalls) {
          const tool = toolMap.get(call.name);
          console.log(
            `[${tool?.label ?? call.name}] ${JSON.stringify(call.input)}`,
          );
          let output: string;
          if (!tool) {
            output = `Error: unknown tool ${call.name}`;
          } else {
            try {
              output = await tool.execute(call.input);
            } catch (err) {
              output = `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
          }
          results.push({ type: "tool_result", toolCallId: call.id, output });
        }
        this.conversation.push({ role: "tool", content: results });
      }
    } catch (err) {
      this.conversation.length = startLength;
      process.stdout.write("\n");
      console.error("internal error " + err);
    }
  }
}
