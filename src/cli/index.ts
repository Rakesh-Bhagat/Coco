import { stdin, stdout } from "process";
import readline from "readline/promises";
import { config } from "dotenv";
import { Agent } from "../agent/agent.js";
config();

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
});

const groq = new Agent("anthropic", {
  id: "claude-haiku-5-5",
  displayName: "claude",
});

async function main() {
  try {
    while (true) {
      const input = await rl.question("You: ");
      if (input.trim().toLowerCase() === "exit") break;
      await groq.run(input);
    }
  } catch (err) {
    console.log("internal error " + err);
  } finally {
    rl.close();
  }
}
main();
rl.on("SIGINT", () => {
  console.log("Adios!");
  rl.close();
});
