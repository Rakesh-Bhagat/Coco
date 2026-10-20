import type { Agent } from "../agent.js";
import { registry, type ProviderId } from "../registry.js";

export async function handleCommand(agent: Agent, input: string) {
  const [cmd, ...args] = input.trim().split(/\s+/);

  switch (cmd) {
    case "/provider": {
      const id = args[0] as ProviderId;
      if (!id || !(id in registry)) {
        console.log(`Usage: /provider <${Object.keys(registry).join("|")}>`);
        return;
      }
      try {
        agent.setProvider(id);
        console.log(`switched to ${id} ${agent.model.id}`);
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : e}`;
      }
      return;
    }
    case "/model": {
      const name = args.join(" ");
      if (!name) {
        const models = await agent.getModel();
        console.log(models.map((m) => m.id).join("\n"));
        return;
      }
      try {
        await agent.setModel({ id: name, displayName: name });
        console.log(`Model set to ${name}`);
      } catch (err) {
        console.log(`Error: ${err instanceof Error ? err.message : err}`);
      }
      return;
    }
    default:
      console.log(`Unknown command: ${cmd}. Try /provider or /model.`);
  }
}
