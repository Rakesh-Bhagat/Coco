import { readFile, stat } from "fs/promises";

const MAX_BYTES = 5 * 1024 * 1024;
export const DEFAULT_LIMIT = 500;

export async function readFileFunction(
  path: string,
  offset: number = 1,
  limit: number = DEFAULT_LIMIT,
): Promise<string> {
  if (typeof path !== "string" || path.trim() === "") {
    return "Error: 'path' is required and must be non-empty string";
  }
  try {
    const info = await stat(path);
    if (info.isDirectory()) {
      return `Error: ${path} is a directory, not a file`;
    }
    if (info.size > MAX_BYTES) {
      return `Error: ${path} is too large ${info.size}, limit ${MAX_BYTES}`;
    }
    const content = await readFile(path, "utf-8");
    if (content.includes("\0")) {
      return `Error: ${path} appears to be a binary file`;
    }
    if (!Number.isInteger(offset) || offset < 1) {
      return `Error: 'offset' must be integer >= 1`;
    }
    if (!Number.isInteger(limit) || limit < 1) {
      return `Error: 'limit' must be integer >= 1`;
    }

    const lines = content.split("\n");
    if (offset > lines.length) {
      return `Error: offset ${offset} past the end of the file (${lines.length}) lines`;
    }

    const end = Math.min(offset - 1 + limit, lines.length);
    let out = lines.slice(offset - 1, end).join("\n");
    if (end < lines.length) {
      out += `\n\n[showing lines ${offset}-${end} of ${lines.length}. Use offset=${end + 1} to continue]`;
    }
    return out;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    switch (code) {
      case "ENOENT":
        return `Error: File not found: ${path}`;
      case "EACCES":
      case "EPERM":
        return `Error: permission denied ${path}`;
      default:
        return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}
