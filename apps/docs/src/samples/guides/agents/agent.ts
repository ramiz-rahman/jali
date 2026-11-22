import type { Jali } from "jali";
import { createAgent } from "jali/agent";

// Your model client: anything that takes tools and runs a conversation with them.
declare function runModel(options: {
  prompt: string;
  tools: {
    name: string;
    description: string;
    inputSchema: object;
    execute(input: unknown): unknown;
  }[];
}): Promise<string>;

export function connectAgent(jali: Jali) {
  const agent = createAgent(jali, {
    // Everything but closing panes: the agent opens, arranges and pins; the person closes.
    actions: [
      "focus",
      "openBeside",
      "addTab",
      "peek",
      "select",
      "moveTab",
      "setPinned",
      "autoLayout",
      "preset",
    ],
    // Asked before every step. A string refuses it, and the agent hears why.
    allow: (step) => step.action !== "preset" || jali.get().page === null || "Leave the page first",
    // The agent adds and removes panes; Jali arranges them after each turn.
    arrange: "after-changes",
  });

  // Offer the tools to the browser's own agent, where it has one (WebMCP).
  const withdraw = agent.registerTools();

  // Or give them to your own model.
  const ask = (prompt: string) => runModel({ prompt, tools: agent.tools() });

  return { agent, ask, withdraw };
}
