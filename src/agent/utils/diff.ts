import { structuredPatch } from "diff";
import { cyan, dim, green, red } from "./format.js";

const MAX_DIFF_LINES = 200;

export function renderDiff(path: string, before: string, after: string) {
  const patch = structuredPatch(path, path, before, after, "", "", {
    context: 3,
  });
  if (patch.hunks.length === 0) return dim("(no changes)");

  const out: string[] = [];
  for (const h of patch.hunks) {
    out.push(
      cyan(`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`),
    );
    for (const line of h.lines) {
      if (line.startsWith("\\")) continue; // "\ No newline at end of file"
      if (line.startsWith("+")) out.push(green(line));
      else if (line.startsWith("-")) out.push(red(line));
      else out.push(dim(line));
    }
  }
  if (out.length <= MAX_DIFF_LINES) return out.join("\n");
  return (
    out.slice(0, MAX_DIFF_LINES).join("\n") +
    dim(`\n... diff truncated (${out.length - MAX_DIFF_LINES} more lines)`)
  );
}
