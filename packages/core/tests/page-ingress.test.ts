/**
 * What a page hands Jali is checked and copied like anything else that enters (step 5 review): role ids are never
 * unsafe, and the refs its `bind` returns (often cached by the app) are copied before they are installed.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, pane, row } from "@jali/core";
import { definePageEngine as definePage } from "@jali/core/adapter";

const ticket = { kind: "ticket", title: "Ticket", params: { id: String }, width: { min: 200 } };
const page = (
  home: string,
  cache?: Record<string, { kind: string; params: Record<string, string> }>,
) =>
  definePage({
    id: "desk",
    name: "Desk",
    itemNoun: "ticket",
    home,
    roles: [{ id: home, label: "Ticket", priority: "primary" as const }],
    firstItem: "t-1",
    bind: (item: string) => cache ?? { [home]: { kind: "ticket", params: { id: item } } },
    build: (item: string) =>
      pane({ kind: "ticket", params: { id: item } }, { id: home, role: home }),
  });
const make = (p: ReturnType<typeof page>) =>
  createJali({
    panes: [ticket],
    layout: row(pane({ kind: "ticket", params: { id: "a" } }, { id: "a" })),
    page: p,
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
  });

describe("a page", () => {
  it.each(["__proto__", "constructor", "prototype"])("can't have a role named %s", (role) => {
    expect(() => make(page(role))).toThrow(/role/);
  });

  it("gets its bound refs copied: editing the app's cached ref changes nothing and throws nothing", () => {
    const cached = { main: { kind: "ticket", params: { id: "t-2" } } };
    const jali = make(page("main", cached));
    jali.page!.open();
    jali.page!.setMode("split");
    jali.page!.showItem("t-2");
    expect(() => (cached.main.params.id = "t-99")).not.toThrow();
    expect(jali.model().pane("main")?.ref.params.id).toBe("t-2");
  });
});
