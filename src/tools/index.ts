import type { Tool } from "../agent/types.js";
import { bashFunction, isSafeCommand } from "./bash.js";
import { describeEdit, editFileFunction, type EditInput } from "./editFile.js";
import { globFunction } from "./glob.js";
import { grepFunction, type GrepInput } from "./grep.js";
import { listDir } from "./listDirectory.js";
import { DEFAULT_LIMIT, readFileFunction } from "./readFile.js";
import { describeWrite, writeFileFunction } from "./writeFile.js";

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
  title: ({ path }) => path,
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
  title: ({ folderPath }) => folderPath,
  execute: ({ folderPath }) => listDir(folderPath),
};
const globTool: Tool<{ pattern: string }> = {
  name: "glob",
  label: "Glob",
  description:
    "Finds files and directories matching a glob pattern. Use this tool to search for files by name or path pattern, such as '**/*.ts' for all TypeScript files or 'src/**/*.tsx' for TSX files inside the src directory.",
  input: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "pattern to search for",
      },
    },
    required: ["pattern"],
  },
  title: ({ pattern }) => pattern,
  execute: ({ pattern }) => globFunction(pattern),
};
const grepTool: Tool<GrepInput> = {
  name: "grep",
  label: "Grep",
  description:
    "Search for a text pattern or regular expression across files. Returns matching lines with file names and line numbers. Use this tool to find code, functions, variables, or specific text without reading entire files.",
  input: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regex pattern to search for" },
      path: {
        type: "string",
        description: "File or directory to search. default=current directory",
      },
      glob: {
        type: "string",
        description: "Only search files matching this glob, e.g. '*.ts'",
      },
      ignoreCase: { type: "boolean", description: "Case-insensitive search" },
      context: {
        type: "number",
        description: "Number of context lines to show around each match",
      },
    },
    required: ["pattern"],
  },
  title: ({ pattern, path }) => (path ? `${pattern} in ${path}` : pattern),
  execute: (input, signal) => grepFunction(input, signal),
};
const writeFileTool: Tool<{ path: string; content: string }> = {
  name: "write_file",
  label: "Write File",
  description:
    "Creates a file or completely overwrites an existing one with the given content. Prefer edit_file for modifying existing files. Paths must be inside the project directory.",
  input: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path of the file to write" },
      content: { type: "string", description: "Full content of the file" },
    },
    required: ["path", "content"],
  },
  requiresApproval: true,
  title: ({ path }) => path,
  describeCall: ({ path, content }) => describeWrite(path, content),
  execute: ({ path, content }) => writeFileFunction(path, content),
};
const editFileTool: Tool<EditInput> = {
  name: "edit_file",
  label: "Edit File",
  description:
    "Replaces text in an existing file. 'oldString' must match the file exactly (including whitespace) and appear exactly once, unless replaceAll is true. Read the file first so the match is exact.",
  input: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path of the file to edit" },
      oldString: { type: "string", description: "Exact text to replace" },
      newString: { type: "string", description: "Text to replace it with" },
      replaceAll: {
        type: "boolean",
        description: "Replace every occurrence. default=false",
      },
    },
    required: ["path", "oldString", "newString"],
  },
  requiresApproval: true,
  title: ({ path }) => path,
  describeCall: (input) => describeEdit(input),
  execute: (input) => editFileFunction(input),
};
const bashTool: Tool<{ command: string; timeout?: number }> = {
  name: "bash",
  label: "Bash",
  description:
    "Runs a shell command and returns its combined stdout/stderr and exit code. Use for git, running tests, installing packages, etc. Do not use it to read files or search; use read_file, glob and grep instead. Commands time out after 30s by default.",
  input: {
    type: "object",
    properties: {
      command: { type: "string", description: "The command to run" },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds. default=30000",
      },
    },
    required: ["command"],
  },
  requiresApproval: ({ command }) => !isSafeCommand(command),
  title: ({ command }) => command,
  execute: ({ command, timeout }, signal) =>
    bashFunction(command, timeout, signal),
};
export const tools: Tool<any>[] = [
  readFileTool,
  listDirectoryTool,
  globTool,
  grepTool,
  writeFileTool,
  editFileTool,
  bashTool,
];
export const toolMap = new Map<string, Tool<any>>(
  tools.map((t) => [t.name, t]),
);
