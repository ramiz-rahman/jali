/**
 * An id that names something on `Object.prototype` can't enter (stabilisation step 5, A1-1): not from code (`pane()`
 * throws in development), not through `setLayout`, a preset, saved storage or a link. Reads are on `own()` too, so
 * the check is the second line, not the only one.
 */
import { describe, expect, it, vi } from "vite-plus/test";
import {
  createJali,
  layout as L,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  type Layout,
  type LayoutInput,
} from "@jali/core";
import { urlSync } from "../src/features/url-sync";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });
const UNSAFE = ["__proto__", "constructor", "prototype"];

/** The layout a builder draft stands for (a copy, since an instance's own is frozen in development). */
const built = (draft: LayoutInput) =>
  structuredClone(
    createJali({
      panes: [item, { kind: "constructor", title: "C" }],
      layout: draft,
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    }).getLayout(),
  ) as Layout;

/** A layout with `id` on its second pane, built without the builder's check. */
const bad = (id: string): Layout => {
  const layout = built(row(pane(ref(1), { id: "a" }), pane(ref(2), { id: "b" })));
  const root = layout.root as unknown as { children: { id: string }[] };
  Object.defineProperty(root.children[1]!, "id", { value: id, enumerable: true });
  return layout;
};
const make = (o: Record<string, unknown> = {}) =>
  createJali({
    panes: [item],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...o,
  });
const ids = (j: ReturnType<typeof make>) => L.tree.panes(j.getLayout().root).map((p) => p.id);

describe.each(UNSAFE)("the id %s", (id) => {
  it("is refused by pane() in development", () => {
    expect(() => pane(ref(1), { id })).toThrow(/id/);
  });
  it("is invalid from setLayout, and nothing changes", () => {
    const jali = make({ layout: row(pane(ref(1), { id: "a" })) });
    expect(jali.setLayout(bad(id))).toMatchObject({ ok: false, reason: "invalid" });
    expect(ids(jali)).toEqual(["a"]);
  });
  it("is not a layout a preset or saved storage can start from", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const preset = make({
      layout: bad(id),
      presets: [{ id: "home", label: "Home", layout: row(pane(ref(5), { id: "ok" })) }],
    });
    expect(ids(preset)).toEqual(["ok"]);
    const viaPreset = make({
      presets: [
        { id: "x", label: "X", layout: bad(id) },
        { id: "y", label: "Y", layout: row(ref(3)) },
      ],
    });
    expect(ids(viaPreset)).not.toContain(id);
    err.mockRestore();
  });
  it("makes a link unreadable: the instance opens its fallback", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const location = memoryLocation(`?l=${L.encode(bad(id))}`);
    const jali = make({
      layout: row(pane(ref(9), { id: "home" })),
      features: [urlSync({ location })],
    });
    jali.start();
    expect(ids(jali)).toEqual(["home"]);
    err.mockRestore();
  });
  it("is refused in every place a layout holds an id", () => {
    const base = built(row(pane(ref(1), { id: "a" }), pane(ref(2), { id: "b" })));
    const variants: Layout[] = [
      { ...base, root: { ...base.root, id } },
      (() => {
        const l = structuredClone(base);
        (l.root as unknown as { children: { linkedTo?: string }[] }).children[1]!.linkedTo = id;
        return l;
      })(),
      { ...base, overlay: { tucks: [], folds: [id], shown: {}, hidden: [] } },
      { ...base, overlay: { tucks: [], folds: [], shown: { [id]: "a" }, hidden: [] } },
      { ...base, overlay: { tucks: [], folds: [], shown: { a: id }, hidden: [] } },
      { ...base, overlay: { tucks: [], folds: [], shown: {}, hidden: [id] } },
      {
        ...base,
        overlay: { tucks: [{ pane: id, home: "a", seq: 0 }], folds: [], shown: {}, hidden: [] },
      },
      {
        ...base,
        overlay: { tucks: [{ pane: "b", home: id, seq: 0 }], folds: [], shown: {}, hidden: [] },
      },
    ];
    const jali = make({ layout: base });
    for (const v of variants)
      expect(jali.setLayout(v)).toMatchObject({ ok: false, reason: "invalid" });
  });
});

it("a kind named like an unsafe id still gets a safe node id", () => {
  const layout = built(row({ kind: "constructor", params: {} }));
  expect(L.tree.panes(layout.root)[0]!.id).not.toBe("constructor");
});
