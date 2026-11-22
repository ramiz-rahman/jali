/**
 * Every public action checks what it is given before its step runs (architecture review 22 Nov 2026, P1-3). A call
 * from JavaScript or an agent's step with a value its type doesn't allow is refused as "invalid", the same for both,
 * and nothing is stored as given: `page.setMode("invalid-mode")` used to answer ok and keep that mode.
 */
import { describe, expect, it } from "vite-plus/test";
import { createJali, memoryStorage, pane, row } from "@jali/core";
import { definePageEngine as definePage } from "@jali/core/adapter";
import { createAgent } from "@jali/core/agent";

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

const make = () =>
  createJali({
    panes: [ticket, note],
    layout: row(
      pane({ kind: "ticket", params: { id: "a" } }, { id: "a" }),
      pane({ kind: "note", params: {} }, { id: "b" }),
    ),
    page: desk,
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
  });

type Call = (j: ReturnType<typeof make>) => { ok: boolean; reason?: string };
const bad = (f: unknown) => f as never;

describe("a public action given what its type doesn't allow", () => {
  it.each<[string, Call]>([
    ["page.setMode", (j) => j.page.setMode(bad("invalid-mode"))],
    ["page.setLinkMode", (j) => j.page.setLinkMode(bad("never"))],
    ["page.showView", (j) => j.page.showView(bad(3))],
    ["page.showItem", (j) => j.page.showItem(bad({ id: 1 }))],
    ["page.open", (j) => j.page.open(bad("t-1"))],
    ["move", (j) => j.actions.move("a", bad("diagonal"))],
    ["moveTab", (j) => j.actions.moveTab("a", bad("1"))],
    ["setPinned", (j) => j.actions.setPinned("a", bad("yes"))],
    ["setKept", (j) => j.actions.setKept("a", bad(1))],
    ["closeTabs", (j) => j.actions.closeTabs("a", bad("all"))],
    ["split", (j) => j.actions.split("a", bad("left"))],
    [
      "openBeside",
      (j) => j.actions.openBeside("a", { kind: "note", params: {} }, bad({ edge: "up" })),
    ],
    ["select", (j) => j.actions.select("a", null, bad("in"))],
    ["focus", (j) => j.actions.focus(bad(42))],
    ["preset", (j) => j.actions.preset(bad(1))],
    ["changeSettings", (j) => j.actions.changeSettings(bad("dark"))],
  ])("%s is refused as invalid, and nothing changes", (_, call) => {
    const jali = make();
    jali.page.open();
    const before = jali.get();
    expect(call(jali)).toMatchObject({ ok: false, reason: "invalid" });
    expect(jali.get().layout).toBe(before.layout);
    expect(jali.get().page).toBe(before.page);
    expect(jali.get().settings).toBe(before.settings);
  });

  it("is the same refusal for an agent", async () => {
    const jali = make();
    jali.page.open();
    const agent = createAgent(jali);
    const mode = jali.get().page?.mode;
    const r = await agent.act({ steps: [{ action: "page.setMode", args: ["invalid-mode"] }] });
    expect(r.ok).toBe(false);
    expect(r.steps[0]).toMatchObject({ action: "page.setMode", ok: false, reason: "invalid" });
    expect(jali.get().page?.mode).toBe(mode);
  });

  it("still takes what it allows: an option left out, a valid value", () => {
    const jali = make();
    jali.page.open();
    expect(jali.page.setMode("single").ok).toBe(true);
    expect(jali.get().page?.mode).toBe("single");
    expect(jali.page.setMode("split").ok).toBe(true);
    expect(
      jali.actions.openBeside("main", { kind: "note", params: {} }, { edge: "bottom" }).ok,
    ).toBe(true);
  });
});
