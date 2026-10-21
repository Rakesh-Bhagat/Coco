import { stdin, stdout } from "process";
import readline from "readline/promises";
import { config } from "dotenv";
import { Agent } from "../agent/agent.js";
import { bold, dim } from "../agent/utils/format.js";
import { handleCommand } from "../agent/utils/handleCommand.js";
import { readInput } from "./readInput.js";
import emitKeypress from "readline";
import {
  below,
  setPending,
  toggleExpand,
  track,
} from "../agent/utils/toolDisplay.js";
config({ path: new URL("../../.env", import.meta.url) });

// ctrl+o expands / collapses the most recent tool call header
emitKeypress.emitKeypressEvents(stdin);
stdin.on("keypress", (_str, key) => {
  if (key?.ctrl && key.name === "o") toggleExpand();
});

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
});

const agent = new Agent(
  "anthropic",
  {
    id: "claude-haiku-5-5",
    displayName: "claude-haiku-5-5",
  },
  async ({ summary, signal }) => {
    if (summary) below(`\n${summary}\n`);
    const prompt = dim("  Allow? [y]es / [n]o / [a]lways: ");
    setPending(() => prompt + rl.line);
    let raw: string;
    try {
      raw = await rl.question(prompt, { signal });
    } finally {
      setPending(null);
    }
    track(prompt + raw + "\n");
    const ans = raw.trim().toLowerCase();
    if (ans === "a" || ans === "always") return "always";
    if (ans === "y" || ans === "yes") return "yes";
    return "no"; // anything else, including empty input, denies
  },
);

// the run currently in progress, if any; Ctrl+C aborts it
let activeRun: AbortController | null = null;
let exiting = false;

async function main() {
  try {
    console.log(
      `${bold("Coco")} ${dim("· terminal coding agent · type exit to quit")}`,
    );
    console.log(dim(`\n${agent.id} · ${agent.model.displayName}`));
    while (true) {
      const input = await readInput(rl, "You: ");
      if (input.trim().toLowerCase() === "exit") break;
      if (input.trim().startsWith("/")) {
        await handleCommand(agent, input);
        continue;
      }
      const controller = new AbortController();
      activeRun = controller;
      try {
        await agent.run(input, controller.signal);
      } finally {
        activeRun = null;
      }
      if (exiting) {
        console.log("Adios!");
        break;
      }
    }
  } catch (err) {
    console.log("internal error " + err);
  } finally {
    rl.close();
  }
}
main();
rl.on("SIGINT", () => {
  if (activeRun) {
    // abort the model call / tool / approval prompt, then main() exits
    exiting = true;
    activeRun.abort();
    return;
  }
  console.log("Adios!");
  rl.close();
});
