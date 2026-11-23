/**
 * The peek is never in the address (docs/DECISIONS.md, 23 Nov 2026): opening or moving it writes nothing, a reload
 * closes it, and an older link's `peek=` is ignored and gone from the address at the next write. Opening the peek's
 * object beside is one history entry from the address before the peek, so Back returns to it.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { definePageEngine as definePage, encodeRef, storeOf } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const list = { kind: "list", title: "List", width: { min: 300 } };
const card = { kind: "card", title: "Card", params: { id: Number }, width: { min: 300 } };
const c = (id: number) => ({ kind: "card", params: { id } });
const page = definePage({
  id: "p",
  name: "Page",
  itemNoun: "item",
  home: "main",
  roles: [{ id: "main", label: "Main", priority: "primary" as const }],
  firstItem: 1,
  bind: (item: number) => ({ main: { kind: "card", params: { id: item } } }),
  build: (item: number) =>
    pane({ kind: "card", params: { id: item } }, { id: "main", role: "main" }),
});

const make = (location = memoryLocation()) => {
  const jali = createJali({
    panes: [list, card],
    layout: row(pane({ kind: "list", params: {} }, { id: "a" })),
    page,
    features: [urlSync({ location })],
    storage: memoryStorage(),
    size: { width: 1600, height: 800 },
    moveFocus: false,
  });
  storeOf(jali).start();
  return { jali, location };
};

describe("the peek and the address", () => {
  it("a peek writes nothing, and the address reopens without it", () => {
    const { jali, location } = make();
    const before = [...location.entries];
    jali.actions.peek("a", c(1));
    expect(jali.get().view.peek).toEqual(c(1));
    expect(location.entries).toEqual(before);
    expect(location.search()).not.toContain("peek");
    // A reload: the same address in a fresh instance shows no peek.
    expect(make(memoryLocation(location.search())).jali.get().view.peek).toBeUndefined();
  });

  it("Open beside from the peek is one entry after the address before the peek", () => {
    const { jali, location } = make();
    const before = location.search();
    jali.actions.peek("a", c(2));
    storeOf(jali).actions.openPeekBeside();
    expect(location.entries.at(-2)).toBe(before);
    expect(location.search()).not.toContain("peek");
    expect(jali.model().panes).toHaveLength(2);
  });

  it("a page link holds no peek either", () => {
    const { jali, location } = make();
    jali.page!.open();
    jali.actions.peek("main", c(3));
    expect(location.search()).toContain("page=p");
    expect(location.search()).not.toContain("peek");
  });

  it("an older link's peek= is ignored, and gone at the next write", () => {
    const old = `?page=p&item=1&tab=main&peek=${encodeURIComponent(encodeRef(c(9)))}`;
    const { jali, location } = make(memoryLocation(old));
    expect(jali.get().view.peek).toBeUndefined();
    jali.page!.setMode("split");
    expect(location.search()).toContain("page=p");
    expect(location.search()).not.toContain("peek");
  });
});
