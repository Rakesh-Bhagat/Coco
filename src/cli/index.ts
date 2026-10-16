import { stdin, stdout } from "process";
import readline from "readline/promises";
import { config } from "dotenv";
import { Agent } from "../agent/agent.js";
config();

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
});

const client = new Agent("groq", {
  id: "qwen/qwen3.8-27b",
  displayName: "qwen/qwen3.8-27b",
});

async function main() {
  try {
    while (true) {
      const input = await rl.question("You: ");
      if (input.trim().toLowerCase() === "exit") break;
      await client.run(input);
    }
  } catch (err) {
    console.log("internal error " + err);
  } finally {
    rl.close();
  }
}
main();
rl.on("SIGINT", () => {
  console.log("exit");
  rl.close();
});
