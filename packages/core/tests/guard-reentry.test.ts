/**
 * Host code inside a commit (core review 22 Nov 2026, #1). The host's `beforeClose` that answers at once runs in the
 * middle of a commit that has read the state. What it does meanwhile must neither be lost nor slip past Jali's own
 * question about unsaved work.
 *
 * Before: a guard that pinned pane A while B closed saw both succeed, and A ended unpinned (the close wrote the
 * layout it had read before the guard ran). A guard that reported unsaved work on B, then said yes, closed B without
 * asking "Discard unsaved changes?".
 */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  memoryStorage,
  pane,
  row,
  type ActionResult,
  type JaliOptions,
} from "@jali/core";
import { storeOf } from "@jali/core/adapter";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });
type Jali = ReturnType<typeof createJali>;
const make = (guard: (jali: Jali) => boolean, o: Partial<JaliOptions> = {}) => {
  let jali!: Jali;
  jali = createJali({
    panes: [item],
    layout: row(pane(ref(1), { id: "a" }), pane(ref(2), { id: "b" }), pane(ref(3), { id: "c" })),
    storage: memoryStorage(),
    size: { width: 1600, height: 800 },
    moveFocus: false,
    beforeClose: () => guard(jali),
    ...o,
  });
  return jali;
};
const ids = (jali: Jali) => jali.model().panes.map((p) => p.id);
const pinned = (jali: Jali, id: string) => !!jali.model().pane(id)?.pinned;

describe("an action the guard makes while it decides", () => {
  it("waits for the change being decided, then lands: both changes stand", async () => {
    let inner: ActionResult | undefined;
    const jali = make((j) => ((inner = j.actions.setPinned("a", true)), true));
    expect(jali.actions.close("b")).toMatchObject({ ok: true });
    expect(ids(jali)).toEqual(["a", "c"]);
    expect(pinned(jali, "a")).toBe(true);
    expect(inner).toMatchObject({ ok: false, reason: "pending" });
    await expect(inner!.settled).resolves.toMatchObject({ ok: true });
  });

  it("lands even when the guard says no", () => {
    const jali = make((j) => (j.actions.setPinned("a", true), false));
    expect(jali.actions.close("b")).toMatchObject({ ok: false, reason: "kept" });
    expect(ids(jali)).toEqual(["a", "b", "c"]);
    expect(pinned(jali, "a")).toBe(true);
  });

  it("runs against the state after the change: one aimed at the closed pane finds nothing", async () => {
    let inner: ActionResult | undefined;
    const jali = make((j) => ((inner = j.actions.setPinned("b", true)), true));
    jali.actions.close("b");
    expect(ids(jali)).toEqual(["a", "c"]);
    expect((await inner!.settled)?.ok).toBe(false);
  });

  it("is told after the change it waited for, each as its own layout event", () => {
    const jali = make((j) => (j.actions.setPinned("a", true), true));
    const heard: string[] = [];
    jali.on("layout", (e) => heard.push(e.action ?? e.source));
    jali.actions.close("b");
    expect(heard).toEqual(["close", "setPinned"]);
  });

  it("is refused when the instance is destroyed before it runs", async () => {
    let inner: ActionResult | undefined;
    const jali = make((j) => ((inner = j.actions.setPinned("a", true)), j.destroy(), true));
    jali.actions.close("b");
    expect((await inner!.settled)?.ok).toBe(false);
  });
});

describe("unsaved work the guard reports while it decides", () => {
  it("is asked about: the pane stays until the person answers", () => {
    const jali = make((j) => (storeOf(j).actions.setUnsaved("b", "a draft"), true));
    const r = jali.actions.close("b");
    expect(r).toMatchObject({ ok: false, reason: "unsaved" });
    expect(ids(jali)).toEqual(["a", "b", "c"]);
    expect(jali.model().pane("b")).toBeDefined();
  });

  it("with confirmDiscard: false, the host's yes stands", () => {
    const jali = make((j) => (storeOf(j).actions.setUnsaved("b", "a draft"), true), {
      confirmDiscard: false,
    });
    expect(jali.actions.close("b")).toMatchObject({ ok: true });
    expect(ids(jali)).toEqual(["a", "c"]);
  });
});
