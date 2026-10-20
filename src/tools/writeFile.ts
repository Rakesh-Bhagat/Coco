import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "path";
import { renderDiff } from "../agent/utils/diff.js";

/** Resolves a path and refuses anything outside the project root. */
export function resolveInProject(path: string) {
  if (typeof path !== "string" || path.trim() === "") {
    throw new Error("'path' is required and must be a non-empty string");
  }
  const abs = resolve(path);
  const rel = relative(process.cwd(), abs);
  if (rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
    throw new Error(`${path} is outside the project directory`);
  }
  return abs;
}

async function readExisting(abs: string) {
  try {
    return await readFile(abs, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function describeWrite(path: string, content: string) {
  const abs = resolveInProject(path);
  const before = await readExisting(abs);
  if (before === null) {
    const lines = content.split("\n").length;
    return `create ${path} (${lines} lines)\n${renderDiff(path, "", content)}`;
  }
  return `overwrite ${path}\n${renderDiff(path, before, content)}`;
}

export async function writeFileFunction(path: string, content: string) {
  const abs = resolveInProject(path);
  if (typeof content !== "string") {
    return "Error: 'content' is required and must be a string";
  }
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content, "utf-8");
  return `Wrote ${content.length} characters to ${path}`;
}
