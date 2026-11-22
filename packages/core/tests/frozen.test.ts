/**
 * What a workspace hands out can't change it behind its back (core-codex CORE-10). In development the committed layout
 * and view are frozen: an app that edits `getLayout()`, `get().view` or an event's layout fails at once, and the next
 * commit is the workspace's own.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, row, type Layout } from "@jali/core";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });
const make = () =>
  createJali({
    panes: [item],
    layout: row(ref(1), ref(2)),
    url: false,
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

describe("public snapshots", () => {
  it("can't be edited in development", () => {
    const jali = make();
    const layout = jali.getLayout();
    const root = layout.root as unknown as { children: unknown[] };
    expect(() => root.children.pop()).toThrow(TypeError);
    expect(() => ((jali.get().view as { focused?: string }).focused = "nope")).toThrow(TypeError);
    let heard: Layout | undefined;
    jali.on("layout", (e) => (heard = e.layout));
    jali.actions.openBeside(jali.model().resolved.panes[0]!.id, ref(3));
    expect(Object.isFrozen(heard!.root)).toBe(true);
    expect(jali.model().resolved.panes.length).toBe(3);
  });

  it("an app's own layout object is never frozen", () => {
    const mine = row(ref(1), ref(2));
    const jali = createJali({
      panes: [item],
      layout: mine,
      url: false,
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    expect(Object.isFrozen(mine)).toBe(false);
    expect(jali.getLayout()).not.toBe(mine);
  });
});
