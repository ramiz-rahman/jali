/**
 * The curated page's viewer policy outlives the page (core-codex CORE-8): a limited viewer who leaves for the free
 * workspace and comes back is still limited. Before, leaving dropped the page's state, and with it the policy.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane } from "@jali/core";
import { definePageEngine as definePage } from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

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
      features: [urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1400, height: 800 },
      moveFocus: false,
    });
    expect(jali.page!.open().ok).toBe(true);
    expect(jali.page!.setLinkMode("peek").ok).toBe(true);
    expect(jali.page!.setMode("split").reason).toBe("not-allowed");
    expect(jali.page!.leave().ok).toBe(true);
    expect(jali.page!.open().ok).toBe(true);
    expect(jali.get().linkMode).toBe("peek");
    expect(jali.page!.setMode("split").reason).toBe("not-allowed");
  });

  it("can be set before the page opens", () => {
    const jali = createJali({
      panes: [ticket, note],
      presets: [{ id: "home", label: "Home", layout: { kind: "note", params: {} } }],
      page: desk,
      storage: memoryStorage(),
      size: { width: 1400, height: 800 },
      moveFocus: false,
    });
    expect(jali.page!.setLinkMode("peek").ok).toBe(true);
    jali.page!.open();
    expect(jali.get().linkMode).toBe("peek");
  });
});
