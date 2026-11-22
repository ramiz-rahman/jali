/**
 * Every way into the free layout closes the curated page the same way (core review 22 Nov 2026, #2): a preset, Reset
 * layout, `setLayout` and `page.leave` alike. Before, a preset chosen while a page was open installed its panes but
 * left the page open: `get().page` still named it, and the address read `?page=desk&item=1&tab=main&open=…`, a link
 * to another workspace than the one on screen.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { definePageEngine as definePage, storeOf } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const loan = { kind: "loan", title: "Loan", params: { id: Number }, width: { min: 200 } };
const desk = definePage({
  id: "desk",
  name: "Desk",
  itemNoun: "loan",
  home: "main",
  roles: [{ id: "main", label: "Loan", priority: "primary" as const }],
  firstItem: 1,
  bind: (item: number) => ({ main: { kind: "loan", params: { id: item } } }),
  build: (item: number) =>
    pane({ kind: "loan", params: { id: item } }, { id: "main", role: "main" }),
});
const free = row(pane({ kind: "loan", params: { id: 9 } }, { id: "x" }));
const make = (search = "") => {
  const location = memoryLocation(search);
  const jali = createJali({
    panes: [loan],
    page: desk,
    presets: [
      {
        id: "home",
        label: "Home",
        layout: row(pane({ kind: "loan", params: { id: 5 } }, { id: "h" })),
      },
      { id: "free", label: "Free", layout: free },
    ],
    features: [urlSync({ location })],
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
  });
  jali.start();
  return { jali, location };
};
const ids = (jali: ReturnType<typeof make>["jali"]) => jali.model().panes.map((p) => p.id);

describe("into the free layout from a curated page", () => {
  it.each([
    ["a preset", (j: ReturnType<typeof make>["jali"]) => j.actions.preset("free")],
    ["Reset layout", (j: ReturnType<typeof make>["jali"]) => j.actions.resetLayout()],
    ["setLayout", (j: ReturnType<typeof make>["jali"]) => j.setLayout(free)],
    ["page.leave", (j: ReturnType<typeof make>["jali"]) => j.page!.leave()],
  ])("by %s closes the page, keeps its mode for next time, and drops its undo steps", (_, go) => {
    const { jali } = make();
    expect(jali.page!.open().ok).toBe(true);
    const mode = jali.get().page!.mode;
    expect(go(jali).ok).toBe(true);
    expect(jali.get().page).toBeNull();
    expect(storeOf(jali).get().prefs.mode).toBe(mode);
    expect(storeOf(jali).get().undoStack).toEqual([]);
  });

  it("by a preset writes a link to the free layout, which opens as it was left", () => {
    const { jali, location } = make();
    jali.page!.open();
    jali.actions.preset("free");
    expect(location.search()).not.toContain("page=");
    const reopened = make(location.search()).jali;
    expect(reopened.get().page).toBeNull();
    expect(ids(reopened)).toEqual(ids(jali));
    expect(reopened.model().panes.map((p) => p.ref)).toEqual(jali.model().panes.map((p) => p.ref));
  });
});
