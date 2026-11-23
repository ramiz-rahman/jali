import type { Allow, Jali, ObjectRef } from "jali";

// Your model client: anything that takes tools and runs a conversation with them.
declare function runModel(options: {
  prompt: string;
  tools: {
    name: string;
    description: string;
    inputSchema: object;
    execute(input: never): unknown;
  }[];
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
