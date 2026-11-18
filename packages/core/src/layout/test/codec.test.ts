import { describe, expect, it } from "vite-plus/test";
import * as core from "..";
import { fit, kinds, layout, pane } from "./fixtures";
import type { Layout, LayoutNode } from "../types";

const fromJson = (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return `1.${btoa(Array.from(bytes, (c) => String.fromCharCode(c)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;
};

describe("codec", () => {
  it("round-trips an eight-pane mixed tree with every flag and Unicode", () => {
    const tree = layout(
      pane("a", "list", {
        size: { px: 380 },
        userSized: true,
        ref: { kind: "list", params: { name: "ঢাকা / café 🚀", id: 99 } },
      }),
      {
        id: "col",
        type: "column",
        size: { weight: 3 },
        children: [
          pane("b", "record", { linkedTo: "a", pinned: true, born: 12, base: { weight: 1.5 } }),
          {
            id: "user",
            type: "stack",
            origin: "user",
            size: { weight: 2 },
            active: "d",
            children: [pane("c"), pane("d", "inspector", { pinned: false, userSized: false })],
          },
        ],
      },
      {
        id: "auto",
        type: "stack",
        origin: "user",
        size: { weight: 1 },
        active: "e",
        children: [pane("e"), pane("f")],
      },
      pane("g"),
      pane("h"),
    );
    tree.overlay = { tucks: [{ pane: "h", home: "g", seq: 1 }], folds: ["b"], shown: { g: "h" } };
    const encoded = core.encode(tree);
    expect(encoded).toMatch(/^1\.[A-Za-z0-9_-]+$/);
    expect(encoded.length).toBeLessThan(JSON.stringify(tree).length);
    expect(core.decode(encoded, kinds)).toEqual(tree);
    expect(core.encode(core.decode(encoded, kinds)!)).toBe(encoded);
  });
  it("round-trips a single pane and a result handle without looking up objects", () => {
    const tree = layout(
      pane("gone", "record", {
        ref: { kind: "record", params: { id: "deleted-object", handle: "result-123" } },
      }),
    );
    expect(core.decode(core.encode(tree), kinds)).toEqual(tree);
  });
  it.each([
    "",
    "garbage",
    "2.abc",
    "1.",
    "1.====",
    "1.a+b/",
    "1.A",
    "1._w",
    "1.e30",
    "1.e30=",
    "1. eyJ9",
    "1." + "A".repeat(1_000_000),
  ])("rejects malformed or unsupported encoded input #%#", (text) => {
    expect(core.decode(text, kinds)).toBeNull();
  });
  it.each([
    [2, { i: "a", t: "p", s: [1, 1], r: ["small", {}] }],
    [1, { i: "a", t: "x", s: [1, 1] }],
    [1, { i: "a", t: "p", s: [2, 1], r: ["small", {}] }],
    [1, { i: "a", t: "p", s: [1, 1, 1], r: ["small", {}] }],
    [1, { i: "a", t: "p", s: [1, -2], r: ["small", {}] }],
    [1, { i: "a", t: "p", s: [1, 0], r: ["small", {}] }],
    [1, { i: "a", t: "p", s: [1, null], r: ["small", {}] }],
    [1, { i: "a", t: "p", s: [1, 1], r: ["unknown", {}] }],
    [1, { i: "a", t: "p", s: [1, 1], r: ["small", { id: false }] }],
    [1, { i: "a", t: "p", s: [1, 1], r: ["small", {}], p: "yes" }],
    [1, { i: "a", t: "p", s: [1, 1], r: ["small", {}], u: 1 }],
    [1, { i: "root", t: "r", s: [1, 1], n: [] }],
    [
      1,
      {
        i: "root",
        t: "s",
        s: [1, 1],
        n: [{ i: "a", t: "p", s: [1, 1], r: ["small", {}] }],
        o: "user",
        a: "missing",
      },
    ],
    [
      1,
      {
        i: "root",
        t: "s",
        s: [1, 1],
        n: [{ i: "a", t: "p", s: [1, 1], r: ["small", {}] }],
        o: "other",
        a: "a",
      },
    ],
    [
      1,
      {
        i: "root",
        t: "r",
        s: [1, 1],
        n: [
          { i: "a", t: "p", s: [1, 1], r: ["small", {}] },
          { i: "a", t: "p", s: [1, 1], r: ["small", {}] },
        ],
      },
    ],
  ])("rejects structurally invalid packed layout #%#", (...value) => {
    expect(core.decode(fromJson(value), kinds)).toBeNull();
  });
});

describe("validation", () => {
  it("accepts registered kinds, valid stacks, fixed and weighted sizes", () => {
    const tree = layout({
      id: "tabs",
      type: "stack",
      size: { px: 600 },
      active: "a",
      origin: "user",
      children: [pane("a"), pane("b")],
    });
    expect(core.validate(tree, kinds)).toEqual({ ok: true });
  });
  it("accepts a hand-written stack without `origin`, and round-trips it", () => {
    const tree = layout({
      id: "tabs",
      type: "stack",
      size: { weight: 1 },
      active: "a",
      children: [pane("a"), pane("b")],
    });
    expect(core.validate(tree, kinds)).toEqual({ ok: true });
    expect(core.decode(core.encode(tree), kinds)).toEqual(tree);
  });
  it.each([0, -1, NaN, Infinity, -Infinity])(
    "rejects nonpositive or nonfinite size %s",
    (value) => {
      for (const size of [{ px: value }, { weight: value }]) {
        const tree = layout(pane("a", "small", { size }));
        expect(core.validate(tree, kinds).ok).toBe(false);
        expect(core.decode(core.encode(tree), kinds)).toBeNull();
      }
    },
  );
  it("reports duplicate IDs and unknown kinds together", () => {
    const result = core.validate(layout(pane("a"), pane("a", "missing")), kinds);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toMatch(/duplicate id.*unknown pane kind/);
  });
  it.each([
    null,
    {},
    { version: 2, root: pane("a") },
    { version: 1, root: { ...pane("a"), size: { px: 100, weight: 1 } } },
    { version: 1, root: { ...pane("a"), size: { other: 100 } } },
    { version: 1, root: { ...pane("a"), ref: { kind: "__proto__", params: {} } } },
    { version: 1, root: { ...pane("a"), ref: { kind: "small", params: { id: NaN } } } },
    { version: 1, root: { ...pane("a"), id: "" } },
    { version: 1, root: { ...pane("a"), linkedTo: 123 } },
    { version: 1, root: { ...pane("a"), collapsed: "yes" } },
    {
      version: 1,
      root: {
        id: "s",
        type: "stack",
        size: { weight: 1 },
        origin: "auto",
        axis: "diagonal",
        active: "a",
        children: [pane("a")],
      },
    },
    {
      version: 1,
      root: {
        id: "s",
        type: "stack",
        size: { weight: 1 },
        origin: "user",
        active: "inner",
        children: [{ id: "inner", type: "row", size: { weight: 1 }, children: [pane("a")] }],
      },
    },
  ])("rejects malformed runtime layouts #%# without throwing", (value) => {
    expect(core.validate(value as Layout, kinds).ok).toBe(false);
  });
  it("rejects cycles, shared nodes and excessive nesting", () => {
    const root: LayoutNode = { id: "cycle", type: "row", size: { weight: 1 }, children: [] };
    root.children.push(root);
    expect(core.validate(layout(root), kinds).ok).toBe(false);
    const shared = pane("shared");
    expect(core.validate(layout(shared, shared), kinds).ok).toBe(false);
    let deep: LayoutNode = pane("a");
    for (let i = 0; i < 130; i++)
      deep = { id: `split-${i}`, type: "row", size: { weight: 1 }, children: [deep] };
    expect(core.validate(layout(deep), kinds).ok).toBe(false);
    expect(core.decode(core.encode(layout(deep)), kinds)).toBeNull();
  });
  it("retains missing linked sources and missing objects for caller error UI", () => {
    expect(
      core.validate(
        layout(
          pane("a", "record", {
            linkedTo: "not-open",
            ref: { kind: "record", params: { id: "missing" } },
          }),
        ),
        fit().kinds,
      ),
    ).toEqual({ ok: true });
  });
});
