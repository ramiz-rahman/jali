/**
 * Host code inside an action (core review 22 Nov 2026, #1; the commit model, stabilisation step 2). The host's
 * `beforeClose` runs while an action is worked out, before anything of it is written. What the host does meanwhile is
 * its own commit, made at once with its real result; the action asking is then worked out again from the state then.
 * Nothing the host did is lost, and nothing slips past Jali's own question about unsaved work.
 *
 * Before 22 Nov: a guard that pinned pane A while B closed saw both succeed, and A ended unpinned (the close wrote the
 * layout it had read before the guard ran). A guard that reported unsaved work on B, then said yes, closed B without
 * asking "Discard unsaved changes?". From 22 Nov to step 2, the guard's own actions waited and returned "pending".
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
  it("lands at once, with its real result, and the change being decided lands after: both stand", () => {
    let inner: ActionResult | undefined;
    const jali = make((j) => ((inner = j.actions.setPinned("a", true)), true));
    expect(jali.actions.close("b")).toMatchObject({ ok: true });
    expect(ids(jali)).toEqual(["a", "c"]);
    expect(pinned(jali, "a")).toBe(true);
    expect(inner).toMatchObject({ ok: true });
  });

  it("lands even when the guard says no", () => {
    const jali = make((j) => (j.actions.setPinned("a", true), false));
    expect(jali.actions.close("b")).toMatchObject({ ok: false, reason: "kept" });
    expect(ids(jali)).toEqual(["a", "b", "c"]);
    expect(pinned(jali, "a")).toBe(true);
  });

  it("runs against the state before the change: one aimed at the pane being closed lands, then the pane closes", () => {
    let inner: ActionResult | undefined;
    const jali = make((j) => ((inner = j.actions.setPinned("b", true)), true));
    expect(jali.actions.close("b")).toMatchObject({ ok: true });
    expect(inner).toMatchObject({ ok: true });
    expect(ids(jali)).toEqual(["a", "c"]);
  });

  it("is told before the change being decided, each as its own layout event", () => {
    const jali = make((j) => (j.actions.setPinned("a", true), true));
    const heard: string[] = [];
    jali.on("layout", (e) => heard.push(e.action ?? e.source));
    jali.actions.close("b");
    expect(heard).toEqual(["setPinned", "close"]);
  });

  it("stands when the guard then destroys the instance, and the change being decided is unavailable", () => {
    let inner: ActionResult | undefined;
    const jali = make((j) => ((inner = j.actions.setPinned("a", true)), j.destroy(), true));
    expect(jali.actions.close("b")).toEqual({ ok: false, reason: "unavailable" });
    expect(inner).toMatchObject({ ok: true });
    expect(pinned(jali, "a")).toBe(true);
    expect(ids(jali)).toEqual(["a", "b", "c"]);
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
