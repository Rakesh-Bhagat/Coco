import { createProvider } from "./factory.js";
import type {
  AgentInterface,
  Conversation,
  LLMResponse,
  Model,
  Provider,
} from "./types.js";
import { registry, type ProviderId } from "./registry.js";
const MAX_TURNS = 5;
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
        });
        let stopReason: LLMResponse["stopReason"];
        process.stdout.write("Assistant: ");
        for await (const event of stream) {
          if (event.type === "text_delta") {
            process.stdout.write(event.text);
          }
          if (event.type === "done") {
            this.conversation.push({
              role: "assistant",
              content: [{ type: "text", content: event.response.text }],
            });
            stopReason = event.response.stopReason;
            process.stdout.write("\n");
          }
        }
        if (stopReason !== "tool_use") {
          return;
        }
      }
    } catch (err) {
      this.conversation.length = startLength;
      process.stdout.write("\n");
      console.error("internal error " + err);
    }
  }
}
