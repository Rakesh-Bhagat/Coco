import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Conversation } from "../types.js";

export function toOpenAIMessages(
  messages: Conversation,
  system?: string,
): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [];
  if (system) {
    out.push({ role: "system", content: system });
  }
  for (const msg of messages) {
    if (msg.role === "user") {
      let text = "";
      for (const block of msg.content) {
        if (block.type === "text") {
          text += block.content;
        }
      }
      out.push({ role: "user", content: text });
    } else if (msg.role === "assistant") {
      let text = "";
      const toolCalls: {
        id: string;
        type: "function";
        function: { name: string; arguments: string };
        extra_content?: unknown;
      }[] = [];
      for (const block of msg.content) {
        if (block.type === "text") {
          text += block.content;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
            ...(block.extra !== undefined && { extra_content: block.extra }),
          });
        }
      }
      out.push({
        role: "assistant",
        content: text || null,
        ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
      });
    } else {
      for (const block of msg.content) {
        if (block.type === "tool_result") {
          out.push({
            role: "tool",
            tool_call_id: block.toolCallId,
            content:
              typeof block.output === "string"
                ? block.output
                : JSON.stringify(block.output),
          });
        }
      }
    }
  }
  return out;
}
