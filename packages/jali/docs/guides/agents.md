# Let an agent arrange panes

Give an AI agent your panes as tools, so it can read what is open and open, arrange and pin panes through Jali's own actions, within the limits your app sets.

An agent working beside a person can use the panes the way the person does: read what is open, open an object beside the pane it relates to, put panes in tabs, pin one, or leave the arranging to Jali. It does all of this through `jali.actions`, the same actions a click or a key runs, so the layout stays consistent, and a close that would lose unsaved work still asks the person.

This is for an agent inside your app. For a coding agent that writes Jali code, see [Using Jali with coding agents](../get-started/coding-agents.md).

`src/agent.ts`

```tsx
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
```

## What the agent sees

`agent.snapshot()` is the layout as data, the same as the `jali_snapshot` tool returns:

- **Panes:** each pane's id, kind, title and params, and where it is: `shown`, `tab` (behind another tab), `folded` (folded for lack of room), `tucked` or `hidden`. Also its tab group, whether it is focused, pinned or kept, the pane it was opened from, and any unsaved work or activity.
- **Kinds:** the kinds of pane the app can open, each with its params (`number`, `string`, `boolean` or `one of: …`, with `?` for one a ref may leave out) and its widths.
- **Presets**, the **actions** this agent may use with what each does, and the size and view under `layout` (`side-by-side`, or `one-at-a-time` when a phone shows one pane at a time).

## What the agent does

`agent.act({ steps })` runs steps in order: each an action and its arguments. A pane argument is a pane's id, or the ref of the object it shows. A ref is `{ kind, params }`, checked against its kind before anything runs, so an agent that invents a kind or misses a param hears what is wrong instead of breaking the layout.

```ts
import { createAgent } from "jali/agent";

const agent = createAgent(jali);
agent.act({
  steps: [
    { action: "openBeside", args: ["orders", { kind: "order", params: { id: 1048 } }] },
    { action: "setPinned", args: [{ kind: "order", params: { id: 1048 } }, true] },
  ],
});
```

Steps stop at the first refusal. The result says, for each step, whether it ran, and why not if it didn't (Jali's reason, such as `not-found` or `nothing-to-do`, or `not-allowed` and `invalid`), then gives the snapshot after.

## What your app decides

- **`actions`:** which actions the agent may use, by name. The default is every action that reads or arranges: focus, open, peek, select, tabs, tuck, move, pin, presets, auto layout and the curated page. Removing panes without asking, renaming, dialogs and the person's settings are never offered.
- **`allow`:** asked before each step, with the action and its arguments. Return `false` or a reason to refuse it; the agent hears the reason.
- **`arrange`:** `"when-asked"` (the default) arranges only when the agent runs `autoLayout`. `"after-changes"` also arranges after every turn that opened or closed panes, so the agent can add what it needs and leave the placing to Jali ([auto layout](auto-layout.md)). Choosing it is your permission for that step, whatever `actions` lists, but `allow` is still asked about it (as `autoLayout`, with no arguments). It is skipped when the agent chose the layout itself in that turn (a preset, `setLayout` or its own `autoLayout`), and quietly where there is nothing to arrange, as on a phone.

Every change the agent makes carries `input: "agent"` in Jali's events, so your app can tell it from the person's:

```ts
jali.on("open", ({ ref, input }) => {
  if (input === "agent") console.info("the agent opened", ref);
});
```

## Tools for a model

`agent.tools()` gives two tools, `jali_snapshot` and `jali_act`, each with a description, a JSON Schema for its input and an `execute` that returns MCP-style text content. Hand them to your model client. The descriptions list the actions you allowed, with their arguments.

`agent.registerTools()` offers the same two tools to the browser's own agent through WebMCP (`navigator.modelContext`), an experimental browser API, and returns a function that withdraws them. Where the browser has no such agent, it does nothing.

Every option, result and type is in the [`jali/agent` reference](../reference/agent.md).
