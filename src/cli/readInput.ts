import type { Interface } from "readline/promises";

// A paste arrives as a burst of "line" events in the same tick (or within a few
// ms for very large pastes), while a typed Enter is a single event. Lines that
// arrive within this window of the previous one belong to the same message.
const PASTE_WINDOW_MS = 30;

/**
 * Reads one user message. Unlike `rl.question`, which resolves on the first
 * newline and drops the rest, pasted multi-line text is kept whole.
 * Resolves to "exit" if the input stream closes.
 */
export function readInput(rl: Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    let timer: NodeJS.Timeout | undefined;

    const finish = (text: string) => {
      clearTimeout(timer);
      rl.off("line", onLine);
      rl.off("close", onClose);
      resolve(text);
    };
    const onLine = (line: string) => {
      lines.push(line);
      clearTimeout(timer);
      timer = setTimeout(() => {
        // A paste without a trailing newline leaves its last line sitting in
        // the prompt. Wait for the user to press Enter instead of cutting it off.
        if (rl.line) return;
        finish(lines.join("\n").trimEnd());
      }, PASTE_WINDOW_MS);
    };
    const onClose = () => finish("exit");

    rl.on("line", onLine);
    rl.on("close", onClose);
    rl.setPrompt(prompt);
    rl.prompt();
  });
}
