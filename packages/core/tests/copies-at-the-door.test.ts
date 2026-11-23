/**
 * What an app hands Jali is copied where it enters (stabilisation step 5, INGRESS): the one action entry point, `setLayout`
 * and `createJali`. Mutating a ref, its params or a layout afterwards changes nothing Jali holds, and in development
 * what Jali keeps and hands back, refs and the peek included, is frozen.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, layout as L, memoryStorage, pane, row, type Layout } from "@jali/core";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const make = (o: Record<string, unknown> = {}) =>
  createJali({
    panes: [item],
    layout: row(pane({ kind: "item", params: { id: 1 } }, { id: "a" })),
    storage: memoryStorage(),
    size: { width: 1600, height: 800 },
    moveFocus: false,
    ...o,
  });
const ids = (j: ReturnType<typeof make>) =>
  L.tree.panes(j.getLayout().root).map((p) => `${p.id}:${p.ref.params.id}`);

describe("an action's refs are copied as it enters", () => {
  it("peek", () => {
    const jali = make();
    const ref = { kind: "item", params: { id: 2 } };
    expect(jali.actions.peek("a", ref).ok).toBe(true);
    ref.params.id = 99;
    expect(jali.get().view.peek?.params.id).toBe(2);
  });

  it("openBeside", () => {
    const jali = make();
    const ref = { kind: "item", params: { id: 2 } };
    expect(jali.actions.openBeside("a", ref).ok).toBe(true);
    const before = ids(jali);
    ref.params.id = 99;
    expect(ids(jali)).toEqual(before);
    expect(before.some((p) => p.endsWith(":2"))).toBe(true);
  });

  it("openHere", () => {
    const jali = make();
    const ref = { kind: "item", params: { id: 2 } };
    expect(jali.actions.openHere("a", ref).ok).toBe(true);
    ref.params.id = 99;
    expect(ids(jali)).toEqual(["a:2"]);
  });

  it("addTab, with the ref a Recent list keeps", () => {
    const jali = make();
    const ref = { kind: "item", params: { id: 3 } };
    jali.actions.addTab("a", ref);
    ref.params.id = 99;
    expect(ids(jali).some((p) => p.endsWith(":3"))).toBe(true);
    expect(ids(jali).some((p) => p.endsWith(":99"))).toBe(false);
  });

  it("a held action takes its ref as it was when it was called", async () => {
    let answer!: (ok: boolean) => void;
    const jali = make({ beforeClose: () => new Promise<boolean>((r) => (answer = r)) });
    const ref = { kind: "item", params: { id: 2 } };
    const done = jali.actions.openHere("a", ref);
    ref.params.id = 99;
    answer(true);
    await Promise.resolve(done);
    await new Promise((r) => setTimeout(r));
    expect(ids(jali)).toEqual(["a:2"]);
  });
});

describe("a layout is copied as it enters", () => {
  const mine = (): Layout => ({
    version: 1,
    root: {
      type: "row",
      id: "r",
      size: { weight: 1 },
      children: [
        { type: "pane", id: "x", size: { weight: 1 }, ref: { kind: "item", params: { id: 5 } } },
      ],
    },
  });

  it("setLayout", () => {
    const jali = make();
    const given = mine();
    expect(jali.setLayout(given).ok).toBe(true);
    (
      given.root as unknown as { children: { ref: { params: { id: number } } }[] }
    ).children[0]!.ref.params.id = 99;
    expect(ids(jali)).toEqual(["x:5"]);
  });

  it("createJali, layout and presets", () => {
    const given = mine(),
      preset = mine();
    const jali = make({ layout: given, presets: [{ id: "p", label: "P", layout: preset }] });
    (
      given.root as unknown as { children: { ref: { params: { id: number } } }[] }
    ).children[0]!.ref.params.id = 99;
    expect(ids(jali)).toEqual(["x:5"]);
    (
      preset.root as unknown as { children: { ref: { params: { id: number } } }[] }
    ).children[0]!.ref.params.id = 77;
    jali.actions.resetLayout();
    expect(ids(jali)).toEqual(["x:5"]);
  });
});

describe("what Jali keeps and hands back is frozen in development", () => {
  it("state, the peek and every ref in the layout throw when changed", () => {
    const jali = make();
    jali.actions.peek("a", { kind: "item", params: { id: 2 } });
    expect(
      () => ((jali.get().view.peek as unknown as { params: { id: number } }).params.id = 5),
    ).toThrow(TypeError);
    const root = jali.getLayout().root as unknown as {
      children: { ref: { params: { id: number } } }[];
    };
    expect(() => (root.children[0]!.ref.params.id = 5)).toThrow(TypeError);
  });
});
