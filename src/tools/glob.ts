import { glob } from "fs/promises";
const MAX_RESULTS = 100;
const ignored = new Set(["node_modules", ".git", "dist"]);
export async function globFunction(pattern: string): Promise<string> {
  if (typeof pattern !== "string" || pattern.trim() === "") {
    return `{Error: ${pattern} is required and must be non-empty string}`;
  }
  try {
    const matches: string[] = [];
    let truncated = false;
    const res = await glob(pattern, {
      exclude: (p) => p.split(/[\\/]/).some((seg) => ignored.has(seg)),
    });
    for await (const file of res) {
      if (matches.length > MAX_RESULTS) {
        truncated = true;
        break;
      }
      matches.push(file);
    }
    if (matches.length === 0) {
      return `No mathes found for: ${pattern}`;
    }
    matches.sort();
    const out = matches.join("\n");
    return truncated
      ? `${out}\n\n[truncated: showing first ${MAX_RESULTS} results. use a more specific pattern]`
      : out;
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
