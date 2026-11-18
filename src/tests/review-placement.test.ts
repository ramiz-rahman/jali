/**
 * Loan review, Split view: following a link and placing a view. A link to what is already a view goes there; an opened
 * pane never pushes the person's views aside; a view never folds into a tab group; the ⌥ preview is the commit.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { besidePreview } from "../../packages/core/src/actions/page";
import { createLabStore } from "../lab";
import type { UiStore } from "../../packages/core/src/state/store";


let store: UiStore;
beforeEach(() => {
  localStorage.clear();
  store = createLabStore({ initial: { area: { width: 1156, height: 644 } } }); // the workspace at 1440×900
  store.actions.openPage({ item: 4, tab: "application" });
  store.actions.setMode("split");
});
const m = () => store.model();
const shown = () => m().visible;
const rects = () => Object.fromEntries(m().resolved.panes.filter((b) => !b.hidden).map((b) => [b.id, b.rect]));
const said = () => store.get().announcement.text;
const member149 = { kind: "record", params: { table: "members", id: "149" } };
/** The reviewer's path: Overview ⌥-clicked beside Application, then Field officer beside Overview. */
function arranged() {
  store.actions.openTabBeside("overview");
  store.actions.openTabBeside("officer");
}

describe("a link to a view already on the page", () => {
  it("the same record is the same object, whichever kind shows it", () => {
    expect(store.env.kinds.sameObject(member149, { kind: "review-record", params: { table: "members", id: 149 } })).toBe(true);
    expect(store.env.kinds.sameObject(member149, { kind: "review-record", params: { table: "members", id: 150 } })).toBe(false);
  });

  it("on screen: focuses that view and opens nothing", () => {
    const before = m().panes.length, at = rects();
    store.actions.openBeside("application", member149);
    expect(m().panes).toHaveLength(before);
    expect(store.get().view.focused).toBe("borrower");
    expect(rects()).toEqual(at);
    expect(said()).toBe("Already open: focused Borrower");
  });

  it("off screen: placed beside the pane the link is in, which stays on screen", () => {
    arranged();
    expect(shown()).not.toContain("borrower");
    const before = m().panes.length;
    store.actions.focus("application");
    store.actions.openBeside("application", member149);
    expect(m().panes).toHaveLength(before);
    expect(shown()).toEqual(expect.arrayContaining(["application", "borrower"]));
    const r = rects(), app = r.application!, bor = r.borrower!;
    expect(bor.x).toBeGreaterThanOrEqual(app.x + app.width);
    expect(said()).toMatch(/^Borrower is already a view on this page/);
  });

  it("an opened pane already showing it is focused, not opened again", () => {
    store.set({ area: { width: 1800, height: 644 } });
    const ref = { kind: "record", params: { table: "loans", id: "30" } };
    const id = store.actions.openBeside("borrower", ref)!;
    const n = m().panes.length;
    store.actions.openBeside("application", ref);
    expect(m().panes).toHaveLength(n);
    expect(store.get().view.focused).toBe(id);
  });
});

describe("an opened pane never pushes the person's views aside", () => {
  it("short of room, it opens as the shown tab of its source's group; every view stays where it was", () => {
    arranged();
    store.actions.focus("application");
    const before = shown(), at = rects();
    const loan30 = { kind: "review-record", params: { table: "loans", id: 30 } };
    const id = store.actions.openBeside("application", loan30)!;
    // Nothing the person placed folded, moved or left; the opened pane is on screen, in Application's place.
    expect(shown()).toEqual(before.map((v) => (v === "application" ? id : v)));
    expect(rects()[id]).toEqual(at.application);
    expect(m().folded).toEqual([]);
    expect(m().resolved.panes.find((b) => b.id === "application")).toMatchObject({ hidden: "tab", stackId: m().resolved.panes.find((b) => b.id === id)!.stackId });
    expect(store.get().view.focused).toBe(id);
    expect(said()).toMatch(/opened as a tab: not enough room beside Application$/);
  });

  it("if even the tab needs more room, a view goes back to the page tabs; none folds", () => {
    arranged();
    store.actions.focus("application");
    // A Data Studio table (min 440): wider than the review views. (Was a record at min 480; records now need 360.)
    const id = store.actions.openBeside("application", { kind: "table", params: { table: "loans" } })!;
    expect(shown()).toEqual([id, "officer"]);
    expect(m().off).toContain("overview");
    expect(m().folded).toEqual([]);
    expect(m().resolved.panes.find((b) => b.id === "application")).toMatchObject({ hidden: "tab", stackId: m().resolved.panes.find((b) => b.id === id)!.stackId });
    expect(said()).toBe("loans opened as a tab: not enough room beside Application · Overview went back to the tabs: not enough room");
  });

  it("from the designed layout at 1440 too: Borrower and Loan history stay", () => {
    const id = store.actions.openBeside("application", { kind: "table", params: { table: "loans" } })!;
    expect(shown()).toEqual([id, "borrower", "history"]);
  });

  it("with room, it opens beside as before", () => {
    store.set({ area: { width: 1800, height: 644 } });
    const id = store.actions.openBeside("application", { kind: "record", params: { table: "loans", id: "30" } })!;
    expect(shown()).toEqual(["application", "borrower", "history", id]);
  });
});

describe("placing a view (⌥-click, drag)", () => {
  it("a view never folds into a tab group: the least recently used go back to the page tabs", () => {
    arranged();
    expect(shown()).toEqual(["application", "overview", "officer"]);
    expect(m().resolved.stacks).toEqual([]);
    expect(m().off).toEqual(expect.arrayContaining(["borrower", "history", "group"]));
    expect(said()).toBe("Field officer placed right of Overview · Loan history, Borrower went back to the tabs: not enough room");
  });

  it("the ⌥ preview is exactly what the click commits: the new view's rect, every view that moves, and what leaves", () => {
    const check = (role: string) => {
      const before = rects();
      const p = besidePreview(store.snapshot(), role)!;
      expect(p).toBeDefined();
      store.actions.openTabBeside(role);
      const after = rects();
      expect(after[role]).toEqual(p.incoming);
      const moved = Object.entries(after).filter(([id, r]) => id !== role && JSON.stringify(before[id]) !== JSON.stringify(r));
      expect(Object.fromEntries(p.moved.map((v) => [v.id, v.rect]))).toEqual(Object.fromEntries(moved));
      expect(p.leaving.sort()).toEqual(Object.keys(before).filter((id) => !after[id]).sort());
    };
    check("overview");
    check("officer");
    check("group");
  });

  it("from Single, the preview is the split layout the click switches to", () => {
    store.actions.setMode("single");
    store.actions.openTab("borrower");
    const p = besidePreview(store.snapshot(), "group")!;
    store.actions.openTabBeside("group");
    expect(store.get().page?.mode).toBe("split");
    expect(rects().group).toEqual(p.incoming);
  });
});

describe("a link with opened panes", () => {
  it("opens in Split view, and leaves the person's own mode as it was", () => {
    const reader = createLabStore({ initial: { area: { width: 1156, height: 644 } } });
    reader.actions.openPage({ item: 4, tab: "application", investigation: [member149], fromUrl: true });
    expect(reader.get().page?.mode).toBe("split");
    expect(reader.get().prefs.mode).toBe("single");
  });
});
