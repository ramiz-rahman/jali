/**
 * Edges of copying at the door (step 5 review): the chooser's items keep their identity, a self-referencing ref can't
 * hang the development freeze, and selections and Recent are frozen like the rest of what get() returns.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, pane, row } from "@jali/core";
import { chooserFeature, storeOf } from "@jali/core/adapter";

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

describe("copies at the door", () => {
  it("dialogs.choose keeps the app's items: a Map-backed label and onChoose see the originals", () => {
    const a = { n: 1 },
      names = new Map([[a, "Alpha"]]);
    const jali = make({ features: [chooserFeature()] });
    const r = jali.dialogs.choose({
      title: "Pick",
      items: [a],
      label: (i: { n: number }) => names.get(i)!,
      onChoose: () => {},
    } as never);
    expect(r.ok).toBe(true);
    const request = (
      storeOf(jali).get().chooser as unknown as {
        request: { items: unknown[]; label: (i: never) => string };
      }
    ).request;
    expect(request.items[0]).toBe(a);
    expect(request.label(a as never)).toBe("Alpha");
  });

  it("a ref that refers to itself neither hangs nor overflows the freeze", () => {
    const jali = make();
    const ref: Record<string, unknown> = { kind: "item", params: { id: 2 } };
    ref.self = ref;
    expect(() => jali.actions.peek("a", ref as never)).not.toThrow();
  });

  it("selections and Recent are frozen in development", () => {
    const jali = make();
    jali.actions.select("a", { kind: "item", params: { id: 3 } });
    const sel = jali.get().selection as unknown as Record<
      string,
      { ref: { params: { id: number } } }
    >;
    expect(() => (sel.a!.ref.params.id = 9)).toThrow(TypeError);
    jali.actions.openHere("a", { kind: "item", params: { id: 4 } });
    const recent = (jali.get() as unknown as { recent?: { params: { id: number } }[] }).recent;
    if (recent?.length) expect(() => (recent[0]!.params.id = 9)).toThrow(TypeError);
  });
});
