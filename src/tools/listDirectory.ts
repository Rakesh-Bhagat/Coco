import { readdir } from "fs/promises";
const MAX_ENTRIES = 150;
export async function listDir(path: string): Promise<string> {
  if (typeof path !== "string" || path.trim() === "") {
    return `'path' is required and must be non-empty string`;
  }
  try {
    const files = await readdir(path, { withFileTypes: true });
    if (files.length === 0) {
      return `${path} is empty`;
    }
    const names = files
      .map((t) => (t.isDirectory() ? `${t.name}/` : t.name))
      .sort();
    const visible = names.slice(0, MAX_ENTRIES).join("\n");
    return names.length > MAX_ENTRIES
      ? `${visible}\n\n[truncated: showing ${MAX_ENTRIES} of ${names.length} entries]`
      : visible;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    switch (code) {
      case "ENOENT":
        return `Error: ${path} directory not found `;
      case "ENOTDIR":
        return `Error: ${path} is a file, not a directory, use read_file to read it`;
      case "EACCES":
      case "EPERM":
        return `Error: permission denied ${path}`;
      default:
        return `Error listing directory: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}
