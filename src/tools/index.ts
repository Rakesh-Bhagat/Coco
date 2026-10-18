import type { Tool } from "../agent/types.js";
import { listDir } from "./listDirectory.js";
import { DEFAULT_LIMIT, readFileFunction } from "./readFile.js";

const readFileTool: Tool<{ path: string; offset?: number; limit?: number }> = {
  name: "read_file",
  label: "Read File",
  description:
    "Reads and returns the contents of a file at the specified path. Use this tool when you need to inspect a file's contents.",
  input: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path of the file to read" },
      offset: {
        type: "number",
        description: "1-based line number to start reading from. default=1",
      },
      limit: {
        type: "number",
        description: `Maximum number of lines to read. default=${DEFAULT_LIMIT}`,
      },
    },
    required: ["path"],
  },
  execute: ({ path, offset, limit }) => readFileFunction(path, offset, limit),
};

const listDirectoryTool: Tool<{ folderPath: string }> = {
  name: "list_directory",
  label: "List Directory",
  description:
    "Lists the files and subdirectories in the specified directory. Use this tool to explore the project structure and discover available files before reading or modifying them.",
  input: {
    type: "object",
    properties: {
      folderPath: {
        type: "string",
        description: "path of the directory to look for",
      },
    },
    required: ["folderPath"],
  },
  execute: ({ folderPath }) => listDir(folderPath),
};
export const tools: Tool<any>[] = [readFileTool, listDirectoryTool];
export const toolMap = new Map<string, Tool<any>>(
  tools.map((t) => [t.name, t]),
);
