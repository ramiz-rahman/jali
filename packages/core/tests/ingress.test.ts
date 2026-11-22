/**
 * Every layout a workspace starts from is checked as `setLayout` and links check theirs (core-opus CORE-1). A saved
 * layout that names a kind removed since, or holds two panes with one id, gives way to a preset, the page or the
 * launcher, and development says why. Before, it crashed start-up ("Unknown pane kind") or put two panes with one id
 * on screen.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createJali,
  layout as L,
  memoryStorage,
  row,
  type JaliOptions,
  type Layout,
} from "@jali/core";

const item = { kind: "item", title: "Item", params: { id: Number }, width: { min: 200 } };
const list = { kind: "list", title: "List", width: { min: 200 } };
const launcher = { kind: "launcher", title: "New", width: { min: 200 } };
const ref = (id: number) => ({ kind: "item", params: { id } });

const make = (o: Partial<JaliOptions>) =>
  createJali({
    panes: [item, list],
    url: false,
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...o,
  });
const kindsOf = (j: ReturnType<typeof make>) =>
  L.tree.panes(j.getLayout().root).map((p) => p.ref.kind);

const removed: Layout = {
  version: 1,
  root: { type: "pane", id: "gone", size: { weight: 1 }, ref: { kind: "zzz", params: {} } },
};
const twins = {
  version: 1,
  root: {
    type: "row",
    id: "r",
    size: { weight: 1 },
    children: [
      { type: "pane", id: "x", size: { weight: 1 }, ref: ref(1) },
      { type: "pane", id: "x", size: { weight: 1 }, ref: ref(2) },
    ],
  },
} as Layout;

let errors: ReturnType<typeof vi.spyOn>;
afterEach(() => errors?.mockRestore());

describe("the layout a workspace starts from", () => {
  it("a saved layout with a removed kind opens the first preset, and says why in development", () => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const jali = make({
      layout: removed,
      presets: [{ id: "home", label: "Home", layout: row({ kind: "list", params: {} }, ref(1)) }],
    });
    expect(kindsOf(jali)).toEqual(["list", "item"]);
    expect(jali.get().presetId).toBe("home");
    expect(String(errors.mock.calls[0]?.[0])).toMatch(/unknown pane kind/);
  });

  it("two panes with one id never reach the screen", () => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const jali = make({ layout: twins, launcher });
    const ids = L.tree.panes(jali.getLayout().root).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(kindsOf(jali)).toEqual(["launcher"]);
  });

  it("skips a preset that can't be shown", () => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const jali = make({
      presets: [
        { id: "old", label: "Old", layout: removed },
        { id: "new", label: "New", layout: row(ref(3)) },
      ],
    });
    expect(jali.get().presetId).toBe("new");
    expect(jali.actions.preset("old").reason).toBe("invalid");
    expect(jali.get().presetId).toBe("new");
  });

  it("throws, naming the problem, only when nothing can be shown", () => {
    errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => make({ layout: removed })).toThrow(/unknown pane kind/);
  });
});
