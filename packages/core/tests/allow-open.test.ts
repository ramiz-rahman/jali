/**
 * `allow.open` (docs/DECISIONS.md, 23 Nov 2026): where it is off for a pane, following a link from that pane never
 * opens a pane. `openBeside` shows the object in the peek sheet instead, in the free layout and on a curated page
 * alike; what only adds panes (Split, New tab, addTab, the peek's Open beside, placing a view off screen) is refused
 * as `"not-allowed"`, and ⌘K lists those commands as unavailable. Showing another object in the same pane is not
 * governed by it, and anyone may use Split view.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, listCommands, memoryStorage, pane, row, type JaliOptions } from "@jali/core";
import { definePageEngine as definePage, storeOf } from "@jali/core/adapter";

const list = { kind: "list", title: "List", width: { min: 300 } };
const card = { kind: "card", title: "Card", params: { id: Number }, width: { min: 300 } };
const locked = { kind: "locked", title: "Locked", width: { min: 300 }, allow: { open: false } };
const launcher = { kind: "new", title: "New pane" };
const c = (id: number) => ({ kind: "card", params: { id } });

const make = (o: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [list, card, locked],
    launcher,
    layout: row(
      pane({ kind: "list", params: {} }, { id: "a" }),
      pane({ kind: "locked", params: {} }, { id: "b" }),
    ),
    storage: memoryStorage(),
    size: { width: 1600, height: 800 },
    moveFocus: false,
    ...o,
  });

const ids = (jali: ReturnType<typeof make>) => jali.model().panes.map((p) => p.id);
const disabled = (jali: ReturnType<typeof make>, id: string) =>
  listCommands(jali).find((cmd) => cmd.id === id)?.disabled;

describe("open off for the instance", () => {
  it("peeks instead of opening a link, and the peek's Open beside stays refused", () => {
    const jali = make({ allow: { open: false } });
    const before = ids(jali);
    expect(jali.actions.openBeside("a", c(1))).toEqual({ ok: true, pane: "a" });
    expect(jali.get().view.peek).toEqual(c(1));
    expect(storeOf(jali).get().peekSource).toBe("a");
    expect(ids(jali)).toEqual(before);
    // Keeping it would open a pane: refused, and the peek stays where it was.
    expect(disabled(jali, "peek.open_beside")).toBe(true);
    expect(storeOf(jali).actions.openPeekBeside()).toMatchObject({ reason: "not-allowed" });
    expect(jali.get().view.peek).toEqual(c(1));
    expect(ids(jali)).toEqual(before);
    // Closing the peek leaves the layout as it was.
    jali.actions.closePeek();
    expect(jali.get().view.peek).toBeUndefined();
    expect(ids(jali)).toEqual(before);
  });

  it("refuses what only adds panes, and lists those commands as unavailable", () => {
    const jali = make({ allow: { open: false } });
    jali.actions.focus("a");
    const layout = jali.getLayout();
    expect(jali.actions.split("a", "right")).toMatchObject({ reason: "not-allowed" });
    expect(jali.actions.newTab("a")).toMatchObject({ reason: "not-allowed" });
    expect(jali.actions.addTab("a", c(2))).toMatchObject({ reason: "not-allowed" });
    expect(storeOf(jali).actions.splitAuto()).toMatchObject({ reason: "not-allowed" });
    expect(jali.getLayout()).toBe(layout);
    for (const id of ["pane.split.right", "pane.split.down", "pane.split.auto", "stack.new-tab"])
      expect(disabled(jali, id)).toBe(true);
  });

  it("still shows another object in the same pane", () => {
    const jali = make({ allow: { open: false } });
    expect(jali.actions.openHere("a", c(3)).ok).toBe(true);
    expect(jali.model().pane("a")!.ref).toEqual(c(3));
    expect(ids(jali)).toEqual(["a", "b"]);
  });
});

describe("open off for one kind, or by `when`", () => {
  it("a kind's `allow` governs links from its panes only", () => {
    const jali = make();
    expect(jali.actions.openBeside("b", c(1)).ok).toBe(true);
    expect(jali.get().view.peek).toEqual(c(1));
    expect(ids(jali)).toEqual(["a", "b"]);
    jali.actions.closePeek();
    // From the list, the link opens a pane, and the peek's Open beside works again.
    const opened = jali.actions.openBeside("a", c(1));
    expect(opened.ok && opened.pane).not.toBe("a");
    expect(ids(jali)).toHaveLength(3);
  });

  it("`when` is asked with the source pane", () => {
    const jali = make({
      allow: { when: ({ action, pane }) => !(action === "open" && pane.id === "a") },
    });
    jali.actions.openBeside("a", c(1));
    expect(ids(jali)).toEqual(["a", "b"]);
    expect(jali.get().view.peek).toEqual(c(1));
    // A peek from the list can't be kept beside it.
    expect(storeOf(jali).actions.openPeekBeside()).toMatchObject({ reason: "not-allowed" });
    jali.actions.closePeek();
    expect(jali.actions.split("a")).toMatchObject({ reason: "not-allowed" });
  });

  it("with open on, the peek's Open beside opens the pane", () => {
    const jali = make();
    jali.actions.peek("a", c(5));
    expect(disabled(jali, "peek.open_beside")).toBe(false);
    expect(storeOf(jali).actions.openPeekBeside().ok).toBe(true);
    expect(jali.get().view.peek).toBeUndefined();
    expect(jali.model().panes.some((p) => p.ref.kind === "card")).toBe(true);
  });
});

describe("open off on a curated page", () => {
  const page = definePage({
    id: "p",
    name: "Page",
    itemNoun: "item",
    home: "main",
    roles: [
      { id: "main", label: "Main", priority: "primary" as const },
      { id: "side", label: "Side", priority: "supporting" as const },
    ],
    firstItem: 1,
    bind: (item: number) => ({
      main: { kind: "card", params: { id: item } },
      side: { kind: "list", params: {} },
    }),
    // Every view is in the design, Side off screen (a view the layout doesn't hold can't be shown: final review).
    build: (item: number) =>
      row(
        pane({ kind: "card", params: { id: item } }, { id: "main", role: "main" }),
        pane({ kind: "list", params: {} }, { id: "side", role: "side", hidden: true }),
      ),
  });

  it("Split view is anyone's, and links from a view peek there", () => {
    const jali = make({ page, allow: { open: false } });
    jali.page!.open();
    expect(jali.page!.setMode("split").ok).toBe(true);
    expect(jali.actions.openBeside("main", c(9)).ok).toBe(true);
    expect(jali.get().view.peek).toEqual(c(9));
    expect(
      storeOf(jali)
        .model()
        .panes.every((p) => p.role),
    ).toBe(true);
    expect(jali.page!.back()).toMatchObject({ reason: "nothing-to-do" });
  });

  it("a view off screen isn't placed beside a pane that doesn't allow open", () => {
    const jali = make({ page, allow: { open: false } });
    jali.page!.open();
    jali.page!.setMode("split");
    expect(storeOf(jali).model().visible).not.toContain("side");
    const layout = jali.getLayout();
    expect(storeOf(jali).actions.placeTab("side", "main", "right")).toMatchObject({
      reason: "not-allowed",
    });
    expect(storeOf(jali).actions.showViewBeside("side")).toMatchObject({ reason: "not-allowed" });
    expect(jali.getLayout()).toBe(layout);
    // A click on its tab still shows it, in place of the view in use.
    expect(jali.page!.showView("side").ok).toBe(true);
    expect(jali.model().pane("side")?.where).toBe("shown");
  });
});
