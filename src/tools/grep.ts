import { rgPath } from "@vscode/ripgrep";
import { spawn } from "child_process";
import { once } from "events";
import { createInterface } from "readline";

export type GrepInput = {
  pattern: string;
  path?: string;
  glob?: string;
  ignoreCase?: boolean;
  context?: number;
};

const DEFAULT_LIMIT = 250;

export async function grepFunction(
  { pattern, path, glob, ignoreCase, context }: GrepInput,
  signal?: AbortSignal,
  limit = DEFAULT_LIMIT,
) {
  const args = ["--line-number", "--no-heading", "--color=never"];
  if (ignoreCase) args.push("-i");
  if (context) args.push("-C", String(context));
  if (glob) args.push("--glob", glob);
  args.push("--", pattern, path ?? ".");

  const p = spawn(rgPath, args, { signal });

  let err = "";
  p.stderr.on("data", (d) => (err += d));
  const exited = once(p, "close") as Promise<[number | null]>;
  exited.catch(() => {});

  const lines: string[] = [];
  let truncated = false;
  const rl = createInterface({ input: p.stdout });
  for await (const line of rl) {
    if (lines.length >= limit) {
      truncated = true;
      p.kill();
      break;
    }
    lines.push(line);
  }

  const [code] = await exited;
  if (!truncated && code !== null && code > 1) {
    throw new Error(err || `rg exited with code ${code}`);
  }
  if (lines.length === 0) return "No matches found.";

  const out = lines.join("\n");
  return truncated
    ? `${out}\n[truncated at ${limit} lines, narrow your search]`
    : out;
}
