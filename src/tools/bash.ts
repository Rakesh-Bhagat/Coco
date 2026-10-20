import { spawn } from "child_process";
import { once } from "events";

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_CHARS = 30_000;

// Read-only commands that skip the approval prompt. Anchored, and anything
// containing shell operators never matches.
const SAFE_COMMAND = /^(git (status|diff|log|branch)|ls|pwd|echo)\b/;
const SHELL_OPERATORS = /[;&|<>`$\n]/;

export function isSafeCommand(command: string) {
  const c = command.trim();
  return SAFE_COMMAND.test(c) && !SHELL_OPERATORS.test(c);
}

function killTree(pid: number) {
  if (process.platform === "win32") {
    // Git Bash (MSYS) children are not linked to their shell in the Windows
    // process tree, so `taskkill /T` alone kills the shell but leaves e.g. the
    // `sleep` behind. Kill the MSYS process group from inside MSYS first (it
    // needs the shell alive to look it up), then taskkill as a fallback.
    const script = `msys=$(ps -W | awk '$4==${pid}{print $1}'); [ -n "$msys" ] && kill -9 -- -$msys`;
    const fallback = () =>
      spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    const k = spawn("bash", ["-c", script], { stdio: "ignore" });
    k.on("error", fallback);
    k.on("close", fallback);
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // already exited
    }
  }
}

export async function bashFunction(
  command: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal?: AbortSignal,
) {
  if (typeof command !== "string" || command.trim() === "") {
    return "Error: 'command' is required and must be a non-empty string";
  }
  const p = spawn(command, {
    shell: process.platform === "win32" ? "bash" : true, // Git Bash on Windows
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32", // own process group on POSIX
  });

  let output = "";
  let truncated = false;
  const append = (d: Buffer) => {
    if (output.length < MAX_OUTPUT_CHARS) output += d.toString();
    else truncated = true;
  };
  p.stdout.on("data", append);
  p.stderr.on("data", append);

  const stop = () => {
    if (p.pid) killTree(p.pid);
    // `close` waits for the output pipes. If a survivor still holds them,
    // don't let cancel hang on it: drop the pipes after a short grace period.
    setTimeout(() => {
      p.stdout.destroy();
      p.stderr.destroy();
    }, 2000).unref();
  };

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeoutMs);

  // Ctrl+C: kill the whole process group so child processes die too
  const onAbort = stop;
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });

  const exited = once(p, "close") as Promise<[number | null]>;
  const [code] = await exited.finally(() => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  });
  if (signal?.aborted) throw new Error("cancelled");

  if (output.length > MAX_OUTPUT_CHARS) {
    output = output.slice(0, MAX_OUTPUT_CHARS);
    truncated = true;
  }
  if (truncated) output += "\n[output truncated]";
  if (timedOut) return `${output}\n[timed out after ${timeoutMs}ms]`;
  return `${output}\n[exit code: ${code}]`;
}
