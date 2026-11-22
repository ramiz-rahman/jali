/** The tab strip's parts (pane/tabGroups.ts), worked out without React: which tabs it lists, and where each goes. */
import { describe, expect, it } from "vite-plus/test";
import type { PaneNode } from "@jali/core";
import type { Tab } from "@jali/core/adapter";
import { tabGroups } from "../src/pane/tabGroups";

const tab = (
  id: string,
  more: { pinned?: boolean; role?: string; folded?: boolean; tucked?: boolean } = {},
): Tab => {
  const node: PaneNode = {
    id,
    type: "pane",
    size: { weight: 1 },
    ref: { kind: "note", params: { id } },
    ...(more.pinned ? { pinned: true } : {}),
    ...(more.role ? { role: more.role } : {}),
  };
  return { node, folded: !!more.folded, tucked: !!more.tucked };
};
const ids = (tabs: Tab[]) => tabs.map((t) => t.node.id);

describe("tabGroups", () => {
  it("puts pinned tabs first, the rest in the scrolling part, in the group's order", () => {
    const g = tabGroups(
      {
        tabs: [tab("a"), tab("p", { pinned: true }), tab("b"), tab("q", { pinned: true })],
        active: "b",
      },
      false,
    );
    expect(ids(g.listed)).toEqual(["a", "p", "b", "q"]);
    expect(ids(g.mine)).toEqual(["a", "p", "b", "q"]);
    expect(ids(g.pinned)).toEqual(["p", "q"]);
    expect(ids(g.scrolling)).toEqual(["a", "b"]);
    expect(g.shownFolded).toEqual([]);
    expect(g.foldedAway).toEqual([]);
    expect(g.activeIn).toBe("scrolling");
  });

  it("draws the underline in the pinned part when the shown tab is pinned", () => {
    const g = tabGroups({ tabs: [tab("a"), tab("p", { pinned: true })], active: "p" }, false);
    expect(g.activeIn).toBe("pinned");
  });

  it("lists only the shown folded pane as a tab; the other folded panes wait behind the chip", () => {
    const g = tabGroups(
      {
        tabs: [
          tab("a"),
          tab("f1", { folded: true }),
          tab("f2", { folded: true }),
          tab("t", { tucked: true }),
        ],
        active: "f2",
      },
      false,
    );
    expect(ids(g.mine)).toEqual(["a", "t"]);
    expect(ids(g.shownFolded)).toEqual(["f2"]);
    expect(ids(g.foldedAway)).toEqual(["f1"]);
    expect(g.activeIn).toBe("scrolling");
    // A tucked tab is still one of yours.
    expect(ids(g.scrolling)).toEqual(["a", "t"]);
  });

  it("with nothing folded shown, every folded pane is behind the chip", () => {
    const g = tabGroups({ tabs: [tab("a"), tab("f", { folded: true })], active: "a" }, false);
    expect(g.shownFolded).toEqual([]);
    expect(ids(g.foldedAway)).toEqual(["f"]);
  });

  it("off a curated page, lists page views like any tab", () => {
    const g = tabGroups({ tabs: [tab("a"), tab("v", { role: "borrower" })], active: "a" }, false);
    expect(ids(g.listed)).toEqual(["a", "v"]);
  });

  it("on a curated page, lists a page view only while it is shown", () => {
    const tabs = [tab("a"), tab("v", { role: "borrower" })];
    expect(ids(tabGroups({ tabs, active: "a" }, true).listed)).toEqual(["a"]);
    expect(ids(tabGroups({ tabs, active: "v" }, true).listed)).toEqual(["a", "v"]);
  });

  it("on a curated page, a group of page views you put together lists each, but not those the layout folded in", () => {
    const g = tabGroups(
      {
        tabs: [
          tab("v1", { role: "borrower" }),
          tab("v2", { role: "loan" }),
          tab("v3", { role: "notes", folded: true }),
        ],
        active: "v1",
      },
      true,
    );
    expect(ids(g.listed)).toEqual(["v1", "v2"]);
    expect(g.foldedAway).toEqual([]);
  });

  it("has no part for the underline when the shown tab isn't listed", () => {
    const g = tabGroups({ tabs: [tab("a"), tab("v", { role: "borrower" })], active: "x" }, true);
    expect(ids(g.listed)).toEqual(["a"]);
    expect(g.activeIn).toBeNull();
  });
});
