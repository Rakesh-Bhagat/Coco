import { readFile, writeFile } from "fs/promises";
import { renderDiff } from "../agent/utils/diff.js";
import { resolveInProject } from "./writeFile.js";

export type EditInput = {
  path: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
};

/** Validates the edit and returns the file content before and after. Throws if it can't apply. */
async function computeEdit({ path, oldString, newString, replaceAll }: EditInput) {
  const abs = resolveInProject(path);
  if (typeof oldString !== "string" || oldString === "") {
    throw new Error("'oldString' is required and must be non-empty");
  }
  if (typeof newString !== "string") {
    throw new Error("'newString' is required and must be a string");
  }
  if (oldString === newString) {
    throw new Error("'oldString' and 'newString' are identical");
  }

  let before: string;
  try {
    before = await readFile(abs, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: ${path}`);
    }
    throw err;
  }

  const count = before.split(oldString).length - 1;
  if (count === 0) throw new Error(`'oldString' not found in ${path}`);
  if (count > 1 && !replaceAll) {
    throw new Error(
      `'oldString' appears ${count} times in ${path}. Add more surrounding context to make it unique, or set replaceAll=true`,
    );
  }

  // function replacer so "$&" etc. in newString are inserted literally
  const after = replaceAll
    ? before.replaceAll(oldString, () => newString)
    : before.replace(oldString, () => newString);
  return { abs, before, after, count };
}

export async function describeEdit(input: EditInput) {
  const { before, after } = await computeEdit(input);
  return `edit ${input.path}\n${renderDiff(input.path, before, after)}`;
}

export async function editFileFunction(input: EditInput) {
  const { abs, after, count } = await computeEdit(input);
  await writeFile(abs, after, "utf-8");
  return `Edited ${input.path} (${input.replaceAll ? count : 1} replacement${input.replaceAll && count > 1 ? "s" : ""})`;
}
