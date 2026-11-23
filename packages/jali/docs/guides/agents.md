# Let an agent arrange panes

Give an AI model two tools of your own, built on jali.model() and jali.actions, so it can read what is open and open panes within the limits your app sets.

A model working beside a person can use the panes the way the person does. Jali has no agent code to install: you write the tools your model needs, over the two things an app already has, `jali.model()` to read the panes and `jali.actions` to change them.

This is for a model inside your app. For a coding agent that writes Jali code, see [Using Jali with coding agents](../get-started/coding-agents.md).

`src/agent.ts`

```tsx
import type { Allow, Jali, ObjectRef } from "jali";

// Your model client: anything that takes tools and runs a conversation with them.
declare function runModel(options: {
  prompt: string;
  tools: { name: string; description: string; inputSchema: object; execute(input: never): unknown }[];
}): Promise<string>;

// Limits, for the model and the person alike: pass as `createJali({ allow })`. A page keeps its panes.
export const allow: Allow = { when: ({ action, page }) => !(page && action === "close") };

export function agentTools(jali: Jali) {
  const listPanes = {
    name: "list_panes",
    description: "The panes: id, title, the object each shows, and whether it is on screen.",
    inputSchema: { type: "object", properties: {} },
    execute() {
      const model = jali.model();
      return model.panes.map((p) => ({
        id: p.id,
        title: model.title(p.id),
        ref: p.ref,
        shown: model.visible.includes(p.id),
      }));
    },
  };

  const openBeside = {
    name: "open_beside",
    description: "Open an object beside a pane. Says why when it cannot.",
    inputSchema: {
      type: "object",
      properties: { pane: { type: "string" }, ref: { type: "object" } },
      required: ["pane", "ref"],
    },
    execute({ pane, ref }: { pane: string; ref: ObjectRef }) {
      const r = jali.actions.openBeside(pane, ref);
      return r.ok ? { ok: true, pane: r.pane } : { ok: false, reason: r.reason };
    },
  };

  return [listPanes, openBeside];
}

export const ask = (jali: Jali, prompt: string) => runModel({ prompt, tools: agentTools(jali) });

// A person's changes carry their pointer or key as `input`; the agent's run in your code, so it is `code`.
export const watch = (jali: Jali) =>
  jali.on("open", ({ ref, input }) => {
    if (input === "code") console.info("opened by code", ref);
  });
```

## What the sample does

- **Reading:** `jali.model()` is the layout as it is on screen. `list_panes` returns each pane's id, title and object, and whether it is shown. Return only what the model needs.
- **Acting:** every action in `jali.actions` returns a typed result. `r.ok` is true, or `r.reason` says why not (`not-found`, `invalid`, `not-allowed`, `last-pane` and the rest of [`RefusalReason`](../reference/core/types.md)). Hand the reason back to the model, which can then try something else. A ref the model invents is refused as `invalid`, and nothing changes.
- **Limits:** `allow` is the one place the app says what may happen, to the model and the person alike. Here a curated page keeps its panes: `close` is refused with `not-allowed` while one is open. A close that would lose unsaved work still asks the person.
- **Telling who did it:** every event carries `input`. A person's change has their pointer or key, `mouse`, `touch`, `pen` or `keyboard`; a change from your code, tool calls included, has `code`.

Offer only the actions you are willing to run for the model. A tool is a function you wrote, so it can open, arrange or pin panes and leave closing, renaming and settings to the person.
