import type { LLMResponse } from "../types.js";

export function mapStopReason(
  reason: string | undefined | null,
): LLMResponse["stopReason"] {
  switch (reason) {
    case "stop":
      return "end";
    case "tool_calls":
    case "function_call":
      return "tool_use";
    case "length":
      return "max_tokens";
    case "content_filter":
      return "other";
    default:
      return undefined;
  }
}
