import { createProvider } from "./factory.js";
import type {
  AgentInterface,
  ApprovalHandler,
  ContentBlock,
  Conversation,
  LLMResponse,
  Model,
  Provider,
  Tool,
  Usage,
} from "./types.js";
import { registry, type ProviderId } from "./registry.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import { toolMap, tools } from "../tools/index.js";
import { createMarkdownStreamer } from "markdansi";
import { renderMarkdown } from "./utils/markdown.js";
import { dim, fmt } from "./utils/format.js";
import { below, end, showTool } from "./utils/toolDisplay.js";
const MAX_TURNS = 20;

const toolDefinitions = tools.map(({ name, description, input }) => ({
  name,
  description,
  input,
}));

function showToolHeader(
  tool: Tool<any> | undefined,
  call: { name: string; input: unknown },
) {
  const label = tool?.label ?? call.name;
  let detail: string;
  try {
    detail = tool?.title?.(call.input) ?? JSON.stringify(call.input);
  } catch {
    detail = JSON.stringify(call.input);
  }
  showTool(label, detail);
}

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
  sessionUsage: Usage = { inputTokens: 0, outputTokens: 0 };
  approve: ApprovalHandler;
  private alwaysAllowed = new Set<string>();
  constructor(id: ProviderId, defaultModel: Model, approve: ApprovalHandler) {
    this.approve = approve;
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
  async run(input: string, signal?: AbortSignal) {
    const startLength = this.conversation.length;
    let calls = 0;
    let lastInput = 0;
    let usageMissing = false;
    const turn: Usage = { inputTokens: 0, outputTokens: 0 };
    try {
      this.conversation.push({
        role: "user",
        content: [{ type: "text", content: input }],
      });
      for (let i = 0; i < MAX_TURNS; i++) {
        signal?.throwIfAborted();
        const stream = this.client.getStreamResponse({
          messages: this.conversation,
          model: this.model.id,
          system: buildSystemPrompt(),
          tools: toolDefinitions,
          signal,
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
                  ...(c.extra !== undefined && { extra: c.extra }),
                });
              }
            }
            calls++;
            const u = event.response.usage;
            if (u) {
              turn.inputTokens += u.inputTokens;
              turn.outputTokens += u.outputTokens;
              lastInput = u.inputTokens;
            } else {
              usageMissing = true;
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
          signal?.throwIfAborted();
          const tool = toolMap.get(call.name);
          showToolHeader(tool, call);
          let output: string;
          if (!tool) {
            output = `Error: unknown tool ${call.name}`;
          } else {
            try {
              const needs =
                typeof tool.requiresApproval === "function"
                  ? tool.requiresApproval(call.input)
                  : tool.requiresApproval;
              let allowed = true;
              if (needs && !this.alwaysAllowed.has(tool.name)) {
                const decision = await this.approve({
                  tool: tool.name,
                  label: tool.label,
                  signal,
                  summary: tool.describeCall
                    ? await tool.describeCall(call.input)
                    : "",
                });
                if (decision === "always") this.alwaysAllowed.add(tool.name);
                signal?.throwIfAborted();
                allowed = decision !== "no";
                if (!allowed) below(dim("  ✗ denied\n"));
              }
              output = allowed
                ? await tool.execute(call.input, signal)
                : "User denied permission to run this tool call. Do not retry it; ask the user how to proceed.";
            } catch (err) {
              if (signal?.aborted) throw err;
              output = `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
          }
          results.push({ type: "tool_result", toolCallId: call.id, output });
        }
        end();
        this.conversation.push({ role: "tool", content: results });
      }
    } catch (err) {
      end();
      this.conversation.length = startLength;
      process.stdout.write("\n");
      if (signal?.aborted) console.log(dim("  cancelled"));
      else console.error("internal error " + err);
    } finally {
      if (calls > 0) {
        this.sessionUsage.inputTokens += turn.inputTokens;
        this.sessionUsage.outputTokens += turn.outputTokens;
        const s = this.sessionUsage;
        console.log(
          dim(
            usageMissing
              ? `${this.id} · ${this.model.id} | usage not reported by provider`
              : `${this.id} · ${this.model.id} | turn: ${fmt(turn.inputTokens)} in / ${fmt(turn.outputTokens)} out` +
                  ` · ${calls} call${calls > 1 ? "s" : ""}` +
                  ` | context ≈ ${fmt(lastInput)}` +
                  ` | session: ${fmt(s.inputTokens + s.outputTokens)}`,
          ),
        );
      }
    }
  }
}
