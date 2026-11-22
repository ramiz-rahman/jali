/**
 * Whether an action can happen is the action's to say (architecture review 22 Nov 2026, P2-10): the tab menu, the
 * header and ⌘K ask the same check (`checkSplit`, `checkZoom`, `checkFullScreen`) for the pane they are about, and
 * decide only how to present it. Before, a curated page hid Split from the tab menu while ⌘K offered it and the
 * action made it.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, listCommands, memoryStorage, pane, row } from "@jali/core";
import { definePageEngine as definePage, storeOf, tabMenuOf } from "@jali/core/adapter";

const ticket = { kind: "ticket", title: "Ticket", params: { id: String }, width: { min: 200 } };
const launcher = { kind: "launcher", title: "New", scratch: true, width: { min: 200 } };
const desk = definePage({
  id: "desk",
  name: "Desk",
  itemNoun: "ticket",
  home: "main",
  roles: [{ id: "main", label: "Ticket", priority: "primary" as const }],
  firstItem: "t-1",
  bind: (item: string) => ({ main: { kind: "ticket", params: { id: item } } }),
  build: (item: string) =>
    pane({ kind: "ticket", params: { id: item } }, { id: "main", role: "main" }),
});

const make = (layout = row(pane({ kind: "ticket", params: { id: "a" } }, { id: "a" }))) =>
  createJali({
    panes: [ticket],
    launcher,
    layout,
    page: desk,
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
  });

const menuIds = (jali: ReturnType<typeof make>, id: string) =>
  tabMenuOf(storeOf(jali), id)
    .flat()
    .map((i) => i.id);
const command = (jali: ReturnType<typeof make>, id: string) =>
  listCommands(jali).find((c) => c.id === id);

describe("Split", () => {
  it("in the free layout: offered everywhere, and made", () => {
    const jali = make();
    jali.actions.focus("a");
    expect(menuIds(jali, "a")).toContain("split-right");
    expect(command(jali, "pane.split.right")?.disabled).toBeFalsy();
    expect(jali.actions.split("a", "right").ok).toBe(true);
  });

  it("on a curated page: offered nowhere, and refused", () => {
    const jali = make();
    jali.page.open();
    jali.page.setMode("split");
    const id = jali.model().panes[0]!.id;
    jali.actions.focus(id);
    expect(menuIds(jali, id)).not.toContain("split-right");
    expect(command(jali, "pane.split.right")?.disabled).toBe(true);
    expect(jali.actions.split(id, "right")).toMatchObject({ ok: false, reason: "unavailable" });
  });
});

describe("Maximise", () => {
  it("for a lone pane: offered nowhere", () => {
    const jali = make();
    jali.actions.focus("a");
    expect(menuIds(jali, "a")).not.toContain("zoom");
    expect(command(jali, "pane.zoom")?.disabled).toBe(true);
  });

  it("beside another pane: offered everywhere", () => {
    const jali = make(
      row(
        pane({ kind: "ticket", params: { id: "a" } }, { id: "a" }),
        pane({ kind: "ticket", params: { id: "b" } }, { id: "b" }),
      ),
    );
    jali.actions.focus("a");
    expect(menuIds(jali, "a")).toContain("zoom");
    expect(command(jali, "pane.zoom")?.disabled).toBeFalsy();
    expect(jali.actions.toggleZoom("a").ok).toBe(true);
    expect(jali.get().view.zoomed).toBe("a");
  });
});
