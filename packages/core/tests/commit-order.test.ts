/**
 * One notification per action, once it is committed (core-opus CORE-16), and events in the order changes were made
 * (core-codex CORE-12). Before, a close notified twice (state, then announcement) in the middle of its batch, and a
 * listener's own change was told before the change it heard, so the last `layout` event was older than the layout.
 */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  row,
  type DeepReadonly,
  type Layout,
} from "@jali/core";
import { createAgent } from "@jali/core/agent";
import { urlSync } from "../src/features/url-sync";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });
const make = () =>
  createJali({
    panes: [item],
    layout: row(ref(1), ref(2), ref(3)),
    features: [urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
  });
const ids = (j: ReturnType<typeof make>) => j.model().resolved.panes.map((p) => p.id);

describe("one notification per action", () => {
  it.each([
    ["close", (j: ReturnType<typeof make>) => j.actions.close(ids(j)[1]!)],
    ["openBeside", (j: ReturnType<typeof make>) => j.actions.openBeside(ids(j)[0]!, ref(9))],
    ["closeOthers", (j: ReturnType<typeof make>) => j.actions.closeOthers(ids(j)[0]!)],
    [
      "undo",
      (j: ReturnType<typeof make>) => {
        j.actions.close(ids(j)[1]!);
        heard.length = 0;
        return j.actions.undo();
      },
    ],
  ])("%s notifies once, with everything in place", (_, act) => {
    const jali = make();
    heard.length = 0;
    jali.subscribe(() => heard.push(jali.get().layout));
    expect(act(jali).ok).toBe(true);
    expect(heard.length).toBe(1);
    expect(heard[0]).toBe(jali.getLayout());
  });
});
const heard: DeepReadonly<Layout>[] = [];

describe("events in the order changes were made", () => {
  it("a listener's change is told after the change it heard, and the last layout is the layout now", () => {
    const jali = make();
    const [a, b, c] = ids(jali);
    const order: string[] = [];
    const layouts: DeepReadonly<Layout>[] = [];
    jali.on("close", () => {
      order.push("close");
      void jali.actions.setPinned(c!, true);
    });
    jali.on("pin", () => order.push("pin"));
    jali.on("layout", (e) => {
      order.push(`layout:${e.action}`);
      layouts.push(e.layout);
    });
    jali.actions.close(b!);
    expect(order).toEqual(["close", "layout:close", "pin", "layout:setPinned"]);
    expect(layouts.at(-1)).toBe(jali.getLayout());
    expect(a).toBeDefined();
  });

  it("subscribers hear a change after its address is written", () => {
    const location = memoryLocation();
    const jali = createJali({
      panes: [item],
      layout: row(ref(1), ref(2)),
      features: [urlSync({ location })],
      storage: memoryStorage(),
      size: { width: 1400, height: 800 },
      moveFocus: false,
    });
    const seen: number[] = [];
    jali.subscribe(() => seen.push(location.entries.length));
    const before = location.entries.length;
    jali.actions.openBeside(ids(jali)[0]!, ref(3));
    expect(seen).toEqual([before + 1]);
  });
});

/**
 * One completed batch, told in one order, each listener on its own (core review 22 Nov 2026, #5). Before, a close
 * told its toast first (inline, during the commit), and a subscriber that threw made the action throw after the pane
 * had closed, with the close event left waiting for a later action.
 */
describe("a batch's events", () => {
  it("are close, layout, then the toast", () => {
    const jali = make();
    const order: string[] = [];
    jali.on("toast", () => order.push("toast"));
    jali.on("close", () => order.push("close"));
    jali.on("layout", () => order.push("layout"));
    jali.actions.close(ids(jali)[1]!);
    expect(order).toEqual(["close", "layout", "toast"]);
  });

  it("still reach everyone when a subscriber throws, and the action returns what it did", () => {
    const jali = make();
    const order: string[] = [];
    jali.on("close", () => order.push("close"));
    jali.on("layout", () => order.push("layout"));
    jali.subscribe(() => {
      throw new Error("a subscriber's bug");
    });
    let after = 0;
    jali.subscribe(() => after++);
    const error = console.error;
    const reported: unknown[] = [];
    console.error = (e: unknown) => reported.push(e);
    try {
      expect(jali.actions.close(ids(jali)[1]!).ok).toBe(true);
    } finally {
      console.error = error;
    }
    expect(order).toEqual(["close", "layout"]);
    expect(after).toBe(1);
    expect(reported).toHaveLength(1);
  });
});

describe("a change made on a later yes", () => {
  it("carries the input of whoever asked for it", async () => {
    let answer!: (yes: boolean) => void;
    const jali = createJali({
      panes: [item],
      layout: row(ref(1), ref(2)),
      storage: memoryStorage(),
      size: { width: 1400, height: 800 },
      moveFocus: false,
      beforeClose: () => new Promise<boolean>((r) => (answer = r)),
    });
    const inputs: string[] = [];
    jali.on("close", (e) => inputs.push(e.input));
    jali.on("layout", (e) => inputs.push(e.input));
    const agent = createAgent(jali);
    agent.act({ steps: [{ action: "close", args: [ids(jali)[1]!] }] });
    answer(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(jali.model().panes).toHaveLength(1);
    expect(inputs).toEqual(["agent", "agent"]);
  });
});
