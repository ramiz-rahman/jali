/**
 * The agent bridge refuses malformed input instead of throwing (core-opus CORE-18): a model that sends `null`, steps
 * that aren't a list, or a step that isn't one hears "invalid", and the workspace is unchanged.
 *
 * Arguments that aren't a list are refused too (core review 22 Nov 2026, #3): `{ action: "close", args: "b" }` once
 * read as no arguments and closed the focused pane, not b.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, pane, row } from "@jali/core";
import { createAgent } from "@jali/core/agent";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const make = () =>
  createJali({
    panes: [item],
    layout: row({ kind: "item", params: { id: 1 } }),
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

describe("an agent's malformed input", () => {
  it.each([
    ["null", null],
    ["a number", 7],
    ["steps that aren't a list", { steps: 5 }],
    ["steps of null", { steps: [null] }],
    ["a step without an action", { steps: [{ args: [] }] }],
    ["a step whose action isn't text", { steps: [{ action: 3 }] }],
  ])("%s is refused as invalid", async (_, input) => {
    const jali = make();
    const layout = jali.getLayout();
    const agent = createAgent(jali);
    const r = agent.act(input as never);
    expect(r.ok).toBe(false);
    expect(r.steps[0]?.reason).toBe("invalid");
    const tool = agent.tools().find((t) => t.name === "jali_act")!;
    await expect(tool.execute(input)).resolves.toBeDefined();
    expect(jali.getLayout()).toBe(layout);
  });
});

describe("a step's arguments", () => {
  const two = () =>
    createJali({
      panes: [item],
      layout: row(
        pane({ kind: "item", params: { id: 1 } }, { id: "a" }),
        pane({ kind: "item", params: { id: 2 } }, { id: "b" }),
      ),
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });

  it.each([
    ["text", "b"],
    ["an object", { pane: "b" }],
    ["null", null],
    ["a number", 1],
  ])("given as %s are refused, and no pane closes", (_, args) => {
    const jali = two();
    jali.actions.focus("a");
    const layout = jali.getLayout();
    const r = createAgent(jali).act({ steps: [{ action: "close", args: args as never }] });
    expect(r.ok).toBe(false);
    expect(r.steps).toMatchObject([{ action: "close", ok: false, reason: "invalid" }]);
    expect(jali.getLayout()).toBe(layout);
  });

  it("left out are none: close() closes the focused pane", () => {
    const jali = two();
    jali.actions.focus("a");
    const r = createAgent(jali).act({ steps: [{ action: "close" }] });
    expect(r.ok).toBe(true);
    expect(jali.model().panes.map((p) => p.id)).toEqual(["b"]);
  });
});

describe("the app's allow, for arranging", () => {
  it("is not asked when the agent doesn't arrange (when-asked)", () => {
    const asked: string[] = [];
    const jali = make();
    const agent = createAgent(jali, { allow: (s) => void asked.push(s.action) });
    agent.act({
      steps: [
        {
          action: "openBeside",
          args: [jali.model().panes[0]!.id, { kind: "item", params: { id: 2 } }],
        },
      ],
    });
    expect(asked).toEqual(["openBeside"]);
  });

  it("is asked before arranging after changes, and its no stops it", () => {
    const asked: string[] = [];
    const jali = make();
    const agent = createAgent(jali, {
      arrange: "after-changes",
      allow: (s) => (asked.push(s.action), s.action !== "autoLayout"),
    });
    const r = agent.act({
      steps: [
        {
          action: "openBeside",
          args: [jali.model().panes[0]!.id, { kind: "item", params: { id: 2 } }],
        },
      ],
    });
    expect(asked).toEqual(["openBeside", "autoLayout"]);
    expect(r.steps.map((s) => s.action)).toEqual(["openBeside"]);
  });
});

describe("a snapshot", () => {
  it("is the agent's to edit: changing a pane's params changes nothing in the workspace", () => {
    const jali = make();
    const snap = createAgent(jali).snapshot();
    (snap.panes[0]!.params as { id: number }).id = 99;
    expect(jali.model().panes[0]!.ref.params).toEqual({ id: 1 });
    expect(createAgent(jali).snapshot().panes[0]!.params).toEqual({ id: 1 });
  });
});
