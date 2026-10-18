import type { ToolDefinition } from "../types.js";

export function toOpenAITool(tools: ToolDefinition[] | undefined) {
  if (!tools?.length) return {};
  return {
    tools: tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input,
      },
    })),
  };
}
