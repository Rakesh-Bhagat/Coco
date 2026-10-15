import { stdin, stdout } from "process";
import readline from "readline/promises";
import { config } from "dotenv";
import { createProvider } from "../agent/factory.js";
import { registry } from "../agent/registry.js";
import type { Conversation } from "../agent/types.js";
config();

const rl = readline.createInterface({
  input: stdin,
  output: stdout,
});

const client = createProvider("groq");
let model = registry.groq.defaultModel;

async function main() {
  let conversation: Conversation = [];
  try {
    while (true) {
      const input = await rl.question("You: ");
      if (input!.trim().toLowerCase() === "exit") {
        break;
      }
      conversation.push({ role: "user", content: input });
      const result = await client.getResponse({
        messages: conversation,
        model,
      });
      conversation.push({ role: "assistant", content: result.text });
      console.log("assistant: " + result.text);
    }
  } catch (error) {
    console.log("intenal error" + error);
  } finally {
    rl.close();
  }
}

rl.on("SIGINT", () => {
  console.log("exit");
  rl.close();
});

main();
