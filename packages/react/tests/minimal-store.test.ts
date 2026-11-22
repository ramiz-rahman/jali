/** A workspace made with the public API alone and few options: what the docs' smallest app does must not throw. */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, type JaliOptions } from "@jali/core";
import { definePageEngine as definePage } from "@jali/core/adapter";
import { definePane } from "@jali/react";
import { runCommand } from "../../core/src/commands/registry";
import { storeOf } from "../../core/src/state/instance";
import { readSearch } from "../../core/src/url";
import { defaultFeatures, urlSync } from "./features";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});
const chooser = definePane("chooser", { title: "New pane", scratch: true, Component: () => null });
const ticket = definePane("ticket", {
  params: { id: String },
  title: ({ id }) => `Ticket ${id}`,
  Component: () => null,
});

const make = (options: Partial<JaliOptions> = {}) => {
  const store = createJali({
    panes: [note, ticket],
    layout: row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...options,
  });
  // The engine's store: these tests reach its steps and raw state.
  const s = storeOf(store);
  s.set({ view: { ...s.get().view, focused: "a" } });
  return s;
};

describe("a workspace without a launcher (finding 4)", () => {
  it("refuses split and new tab instead of throwing", () => {
    const store = make();
    const before = store.get().layout;
    expect(() => store.actions.split(undefined, "right")).not.toThrow();
    expect(() => store.actions.newTab()).not.toThrow();
    expect(store.get().layout).toBe(before);
  });
  it("refuses the split command", () => {
    const store = make();
    expect(() => runCommand(store.jali, "pane.split.right")).not.toThrow();
    expect(store.get().layout.root.type).toBe("row");
  });
  it("opens the `launcher` option's kind", () => {
    const store = make({ launcher: chooser });
    const opened = store.actions.split(undefined, "right");
    expect(opened).toBeDefined();
    expect(store.model().pane(opened.pane!)?.ref.kind).toBe("chooser");
  });
});

describe("a curated page whose items are string ids (finding 13)", () => {
  const profile = definePage({
    id: "desk",
    name: "Desk",
    itemNoun: "ticket",
    home: "main",
    roles: [{ id: "main", label: "Ticket", priority: "primary" as const }],
    firstItem: "t-abc",
    bind: (item: string) => ({ main: ticket({ id: item }) }),
    build: (item: string) => pane(ticket({ id: item }), { id: "main", role: "main" }),
  });
  it("opens on the first item, switches item, and a link carries it", () => {
    const store = make({ page: profile });
    store.run("page.open");
    expect(store.get().page?.item).toBe("t-abc");
    store.run("page.showItem", "t-def");
    expect(store.get().page?.item).toBe("t-def");
    expect(store.model().pane("main")?.ref.params.id).toBe("t-def");
    expect(readSearch(`?page=desk&item=t-xyz`, store.env.kinds.registry())).toMatchObject({
      page: { item: "t-xyz" },
    });
  });
  it("a page with number items still gets numbers from a link", () => {
    const store = make({
      page: {
        ...profile,
        firstItem: 1,
        bind: (i: number) => profile.bind(String(i)),
        build: (i: number) => profile.build(String(i)),
      },
    });
    store.run("page.open", { item: "4" });
    expect(store.get().page?.item).toBe(4);
  });
  it("a page-only app needs no preset or layout: the workspace starts on its page (finding 14)", () => {
    const store = createJali({
      panes: [ticket],
      page: profile,
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    expect(store.get().page).toMatchObject({ profile: "desk", item: "t-abc" });
    expect(store.model().pane("main")?.ref.params.id).toBe("t-abc");
    expect(runCommand(store, "page.leave")).toBe(false);
  });
  it("a page-only app opened from a link shows the link's item, and adds no history entry", () => {
    const location = memoryLocation("?page=desk&item=t-xyz");
    const store = createJali({
      panes: [ticket],
      page: profile,
      features: [...defaultFeatures(), urlSync({ location })],
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
    expect(store.get().page).toMatchObject({ profile: "desk", item: "t-xyz" });
    expect(store.model().pane("main")?.ref.params.id).toBe("t-xyz");
    expect(location.entries).toHaveLength(1);
  });
});
