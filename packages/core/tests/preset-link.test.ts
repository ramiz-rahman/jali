/**
 * A link that names only a preset (`?preset=compare`, a link written by hand, as the docs' Examples page does) opens
 * that preset, as choosing it does: the layout the app saved for it, if any. A preset this instance doesn't have, or
 * a layout link's `preset=` beside its layout, are as before.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, type JaliOptions } from "@jali/core";
import { readSearch, storeOf } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });
const one = row(pane(ref(1), { id: "a" }));
const two = row(pane(ref(2), { id: "b" }), pane(ref(3), { id: "c" }));

function open(search: string, o: Partial<JaliOptions> = {}) {
  const location = memoryLocation(search);
  const jali = createJali({
    panes: [item],
    presets: [
      { id: "one", label: "One", layout: one },
      { id: "two", label: "Two", layout: two },
    ],
    preset: "one",
    features: [urlSync({ location })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...o,
  });
  return {
    jali,
    location,
    ids: () =>
      storeOf(jali)
        .model()
        .panes.map((p) => p.id),
  };
}

describe("a link that names only a preset", () => {
  it("is read as that preset", () => {
    const kinds = storeOf(open("").jali).env.kinds.registry();
    expect(readSearch("?preset=two", kinds)).toEqual({ openPreset: "two", view: {} });
    expect(readSearch("?other=1", kinds)).toBeNull();
  });

  it("opens that preset, and the address then holds its layout and its name", () => {
    const { jali, location, ids } = open("?preset=two");
    expect(ids()).toEqual(["b", "c"]);
    expect(storeOf(jali).get().presetId).toBe("two");
    const q = new URLSearchParams(location.search());
    expect(q.get("preset")).toBe("two");
    expect(q.get("l")).toBeTruthy();
  });

  it("opens the layout the app saved for it, as choosing it does", () => {
    const saved = row(pane(ref(9), { id: "z" }));
    const { ids } = open("?preset=two", {
      presets: [
        { id: "one", label: "One", layout: one },
        { id: "two", label: "Two", layout: two, saved: () => saved },
      ],
    });
    expect(ids()).toEqual(["z"]);
  });

  it("that this instance doesn't have opens as if there were no link", () => {
    const { ids } = open("?preset=nope");
    expect(ids()).toEqual(["a"]);
  });
});
