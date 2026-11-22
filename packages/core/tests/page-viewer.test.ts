/**
 * The curated page's viewer policy outlives the page (core-codex CORE-8): a limited viewer who leaves for the free
 * workspace and comes back is still limited. Before, leaving dropped the page's state, and with it the policy.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, definePage, memoryLocation, memoryStorage, pane } from "@jali/core";

const ticket = { kind: "ticket", title: "Ticket", params: { id: String }, width: { min: 200 } };
const note = { kind: "note", title: "Note", width: { min: 200 } };
const desk = definePage({
  id: "desk",
  name: "Desk",
  itemNoun: "ticket",
  home: "main",
  roles: [
    { id: "main", label: "Ticket", priority: "primary" as const },
    { id: "side", label: "Notes", priority: "supporting" as const },
  ],
  firstItem: "t-1",
  bind: (item: string) => ({
    main: { kind: "ticket", params: { id: item } },
    side: { kind: "note", params: {} },
  }),
  build: (item: string) =>
    pane({ kind: "ticket", params: { id: item } }, { id: "main", role: "main" }),
});

describe("a limited viewer", () => {
  it("stays limited after leaving the page and coming back", () => {
    const jali = createJali({
      panes: [ticket, note],
      presets: [{ id: "home", label: "Home", layout: { kind: "note", params: {} } }],
      page: desk,
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 1400, height: 800 },
      moveFocus: false,
    });
    expect(jali.actions.openPage().ok).toBe(true);
    expect(jali.actions.setCanInvestigate(false).ok).toBe(true);
    expect(jali.actions.setMode("split").reason).toBe("not-allowed");
    expect(jali.actions.leavePage().ok).toBe(true);
    expect(jali.actions.openPage().ok).toBe(true);
    expect(jali.get().page?.canInvestigate).toBe(false);
    expect(jali.actions.setMode("split").reason).toBe("not-allowed");
  });

  it("can be set before the page opens", () => {
    const jali = createJali({
      panes: [ticket, note],
      presets: [{ id: "home", label: "Home", layout: { kind: "note", params: {} } }],
      page: desk,
      url: false,
      storage: memoryStorage(),
      size: { width: 1400, height: 800 },
      moveFocus: false,
    });
    expect(jali.actions.setCanInvestigate(false).ok).toBe(true);
    jali.actions.openPage();
    expect(jali.get().page?.canInvestigate).toBe(false);
  });
});
