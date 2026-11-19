/** The agent bridge (@jali/core/agent): an agent reads the workspace and acts through Jali's own actions. */
import { describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row, type JaliInput } from "@jali/core";
import { createAgent } from "@jali/core/agent";
import { definePane } from "@jali/react";
import { oneOf, optional } from "@jali/core/adapter";

const list = definePane("list", {
  title: () => "Orders",
  width: { min: 320 },
  Component: () => null,
});
const order = definePane("order", {
  params: { id: Number, tab: optional(oneOf("lines", "history")) },
  title: ({ id }) => `Order ${id}`,
  width: { min: 360, comfortable: 480 },
  Component: () => null,
});

const make = () =>
  createJali({
    panes: [list, order],
    layout: row(list(), order({ id: 1 })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1600, height: 900 },
    moveFocus: false,
  });

describe("agent bridge", () => {
  it("reads the panes, the kinds and their params, and what it may do", () => {
    const snap = createAgent(make(), { actions: ["openBeside", "close"] }).snapshot();
    expect(snap.panes.map((p) => [p.kind, p.title, p.state])).toEqual([
      ["list", "Orders", "shown"],
      ["order", "Order 1", "shown"],
    ]);
    expect(snap.kinds.find((k) => k.kind === "order")).toEqual({
      kind: "order",
      params: { id: "number", tab: "one of: lines, history?" },
      minWidth: 360,
      comfortableWidth: 480,
    });
    expect(Object.keys(snap.actions)).toEqual(["openBeside", "close"]);
    expect(snap.workspace.view).toBe("split");
  });

  it("acts through Jali's actions, and its changes say input agent", () => {
    const jali = make();
    const inputs: JaliInput[] = [];
    jali.on("open", ({ input }) => inputs.push(input));
    const pane = jali.model().visible[0]!;
    const r = createAgent(jali).act({
      steps: [{ action: "openBeside", args: [pane, order({ id: 2 })] }],
    });
    expect(r.ok).toBe(true);
    expect(r.snapshot.panes.some((p) => p.title === "Order 2")).toBe(true);
    expect(inputs).toEqual(["agent"]);
  });

  it("stops at the first refusal, and says why", () => {
    const jali = make();
    const r = createAgent(jali).act({
      steps: [{ action: "close", args: ["nope"] }, { action: "autoLayout" }],
    });
    expect(r.ok).toBe(false);
    expect(r.steps).toEqual([{ action: "close", ok: false, reason: "not-found" }]);
  });

  it("refuses what the app doesn't allow, an unknown action, and a ref its kind can't read", () => {
    const allow = vi.fn((s: { action: string }) => s.action !== "close" || "Ask the person first");
    const agent = createAgent(make(), { allow, actions: ["close", "openBeside"] });
    expect(agent.act({ steps: [{ action: "close" }] }).steps[0]).toMatchObject({
      ok: false,
      reason: "not-allowed",
      message: "Ask the person first",
    });
    expect(agent.act({ steps: [{ action: "tuck" }] }).steps[0]).toMatchObject({
      reason: "not-allowed",
    });
    const bad = agent.act({
      steps: [{ action: "openBeside", args: ["x", { kind: "order", params: {} }] }],
    });
    expect(bad.steps[0]).toMatchObject({ ok: false, reason: "invalid" });
    expect(
      agent.act({ steps: [{ action: "openBeside", args: ["x", { kind: "chart", params: {} }] }] })
        .steps[0],
    ).toMatchObject({ reason: "invalid", message: 'There is no kind "chart"' });
  });

  it("with arrange: after-changes, arranges the workspace after the agent opens panes", () => {
    const jali = make();
    const pane = jali.model().visible[0]!;
    const r = createAgent(jali, { arrange: "after-changes" }).act({
      steps: [
        { action: "addTab", args: [pane, order({ id: 2 })] },
        { action: "addTab", args: [pane, order({ id: 3 })] },
      ],
    });
    expect(r.steps.at(-1)).toEqual({ action: "autoLayout", ok: true, auto: true });
    expect(r.snapshot.panes.filter((p) => p.state === "shown").length).toBe(4);
  });

  it("gives a model two tools, and offers them to the browser's agent", async () => {
    const agent = createAgent(make());
    const tools = agent.tools();
    expect(tools.map((t) => t.name)).toEqual(["jali_snapshot", "jali_act"]);
    const out = await tools[0]!.execute({});
    expect(JSON.parse(out.content[0]!.text).panes.length).toBe(2);
    const registered: string[] = [];
    const off = agent.registerTools({
      registerTool: (t) => registered.push(t.name),
      unregisterTool: (n) => registered.splice(registered.indexOf(n), 1),
    });
    expect(registered).toEqual(["jali_snapshot", "jali_act"]);
    off();
    expect(registered).toEqual([]);
    expect(agent.registerTools(undefined)).toBeTypeOf("function");
  });
});
