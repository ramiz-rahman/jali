/**
 * The agent bridge refuses malformed input instead of throwing (core-opus CORE-18): a model that sends `null`, steps
 * that aren't a list, or a step that isn't one hears "invalid", and the workspace is unchanged.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, row } from "@jali/core";
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
