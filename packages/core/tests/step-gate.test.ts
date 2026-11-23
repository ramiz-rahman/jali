/**
 * A step owns its check (stabilisation step 4, docs/DECISIONS.md 23 Nov 2026). The store asks each step's `allow`
 * controls and its check before it runs, and everything that offers the action (⌘K, a key, a menu, a header button,
 * a page's tab, a drop target) asks the same gate (`can`). These follow each offer to what happens when it is taken:
 * an offered command runs (or is refused only for what the run itself finds out), one greyed out changes nothing; a
 * menu item chosen after the layout moved runs as the intent it names; a held action meets `allow` as it is when it is
 * answered; and a curated page never places a view the gate would refuse, whatever mode it starts from.
 */
import { describe, expect, it } from "vite-plus/test";
import {
  createJali,
  listCommands,
  memoryLocation,
  runCommand,
  memoryStorage,
  pane,
  row,
  tabs,
  type JaliOptions,
} from "@jali/core";
import {
  besidePreview,
  can,
  chooseMenuItem,
  commandDefsOf,
  definePageEngine as definePage,
  paneMenuOf,
  STEPS,
  storeOf,
  tabMenuOf,
} from "@jali/core/adapter";
import { urlSync } from "../src/features/url-sync";

const card = { kind: "card", title: "Card", params: { id: Number }, width: { min: 280 } };
const list = { kind: "list", title: "List", width: { min: 280 } };
const launcher = { kind: "new", title: "New pane", width: { min: 200 } };
const c = (id: number) => ({ kind: "card", params: { id } });

const base = (o: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [card, list],
    launcher,
    layout: row(
      pane({ kind: "list", params: {} }, { id: "l" }),
      tabs(pane(c(1), { id: "a" }), pane(c(2), { id: "b" }), pane(c(3), { id: "c" })),
    ),
    storage: memoryStorage(),
    size: { width: 1400, height: 800 },
    moveFocus: false,
    ...o,
  });

/** What a command may still be refused for once it is offered: what only running it finds out. */
const FOUND_BY_RUNNING = new Set(["blocked", "nothing-to-do", "unsaved", "pending", "kept"]);

describe("a command is offered exactly when its step would run", () => {
  const then = (jali: ReturnType<typeof base>, f: (j: typeof jali) => unknown) => (f(jali), jali);
  const scenarios: [string, () => ReturnType<typeof base>][] = [
    ["tabs, focus on a tab", () => then(base(), (j) => j.actions.focus("b"))],
    ["one pane", () => base({ layout: pane(c(1), { id: "a" }) })],
    ["nothing allowed", () => base({ allow: { when: () => false } })],
    ["a peek open", () => then(base(), (j) => j.actions.peek("l", c(7)))],
  ];

  for (const [name, fresh] of scenarios)
    it(name, () => {
      // Each command runs on an instance of its own, set up the same way.
      const listed = listCommands(fresh()).filter(
        (cmd) => cmd.id && !cmd.id.startsWith("layout.copy"),
      );
      expect(listed.length).toBeGreaterThan(20);
      for (const cmd of listed) {
        const jali = fresh();
        const store = storeOf(jali);
        const def = commandDefsOf(store).find((d) => d.id === cmd.id)!;
        const answer = def.step ? can(store, def.step, ...((def.args?.(store) ?? []) as [])) : null;
        if (answer) expect(!answer.ok, cmd.id).toBe(cmd.disabled);
        const before = jali.get();
        // A command that does more than its step (a dialog, DOM focus) runs as ⌘K runs it.
        const ran = def.run
          ? { ok: runCommand(jali, def.id), reason: answer?.reason }
          : store.run(def.step!, ...((def.args?.(store) ?? []) as []));
        if (cmd.disabled) {
          // Greyed out: its step refuses, with the same reason, and nothing changed.
          expect(ran.ok, cmd.id).toBe(false);
          expect(ran.reason, cmd.id).toBe(answer?.reason);
          expect(jali.get().layout, cmd.id).toBe(before.layout);
        } else if (!ran.ok && !def.run) {
          expect(FOUND_BY_RUNNING.has(ran.reason!), `${cmd.id}: ${ran.reason}`).toBe(true);
        }
        jali.destroy();
      }
    });
});

describe("a menu runs the intent it names, when it is chosen", () => {
  const order = (jali: ReturnType<typeof base>) =>
    jali
      .model()
      .stackOf("a")!
      .children.map((t) => t.id);
  const item = (jali: ReturnType<typeof base>, pane: string, id: string) =>
    tabMenuOf(storeOf(jali), pane)
      .flat()
      .find((i) => i.id === id)!;

  it("Move right moves the tab one place right of where it is now", () => {
    const jali = base();
    expect(order(jali)).toEqual(["a", "b", "c"]);
    const right = item(jali, "b", "move-right");
    // Moved elsewhere while the menu was open.
    jali.actions.moveTab("b", 0);
    expect(order(jali)).toEqual(["b", "a", "c"]);
    chooseMenuItem(storeOf(jali), "b", right);
    expect(order(jali)).toEqual(["a", "b", "c"]);
    // Once more, from the end: refused, and the order stays.
    jali.actions.moveTab("b", 2);
    const again = item(jali, "b", "move-left");
    jali.actions.moveTab("b", 0);
    chooseMenuItem(storeOf(jali), "b", again);
    expect(order(jali)).toEqual(["b", "a", "c"]);
  });

  it("Pin sets pinned: chosen after the tab was pinned elsewhere, it stays pinned", () => {
    const jali = base();
    const pin = item(jali, "b", "pin");
    expect(pin.checked).toBe(false);
    jali.actions.setPinned("b", true);
    chooseMenuItem(storeOf(jali), "b", pin);
    expect(jali.model().pane("b")!.pinned).toBe(true);
  });

  it("an app's item gets the pane as it is now, and none once the pane has gone", () => {
    const seen: unknown[] = [];
    const jali = base({ tabMenu: () => [{ id: "copy", title: "Copy", run: (p) => seen.push(p) }] });
    const copy = item(jali, "b", "copy");
    jali.actions.openHere("b", c(9));
    chooseMenuItem(storeOf(jali), "b", copy);
    expect(seen).toEqual([{ id: "b", ref: c(9) }]);
    jali.actions.close("b");
    chooseMenuItem(storeOf(jali), "b", copy);
    expect(seen).toHaveLength(1);
  });

  it("offers what its steps allow, and greys out a move at the end, saying why", () => {
    const jali = base({ allow: { pin: false } });
    const ids = paneMenuOf(storeOf(jali), "a")
      .flat()
      .map((i) => i.id);
    expect(ids).not.toContain("pin");
    expect(item(jali, "a", "move-left").disabled).toBe("Card is already the first tab");
    expect(item(jali, "a", "move-right").disabled).toBeUndefined();
  });
});

describe("a held action meets `allow` as it is when it is answered", () => {
  it("unsaved work, then close turned off: Discard closes nothing", async () => {
    let closable = true;
    const jali = base({ allow: { when: ({ action }) => action !== "close" || closable } });
    const store = storeOf(jali);
    store.actions.setUnsaved("b", "a draft");
    const held = jali.actions.close("b");
    expect(held).toMatchObject({ ok: false, reason: "unsaved" });
    closable = false;
    store.actions.discardAndContinue();
    expect(await held.settled).toMatchObject({ ok: false, reason: "not-allowed" });
    expect(jali.model().pane("b")).toBeDefined();
    // Allowed again, the next close asks again and goes ahead.
    closable = true;
    const again = jali.actions.close("b");
    expect(again.reason).toBe("unsaved");
    store.actions.discardAndContinue();
    expect(await again.settled).toMatchObject({ ok: true });
    expect(jali.model().pane("b")).toBeUndefined();
  });
});

describe("Open full is gone (A2-4)", () => {
  it("no step, no command: a peek on a page is kept beside or closed, never made the whole layout", () => {
    expect("openPeekFull" in STEPS).toBe(false);
    const jali = base();
    expect(commandDefsOf(storeOf(jali)).map((d) => d.id)).not.toContain("peek.open_full");
  });
});

describe("a curated page places a view only where the gate lets it (step 1b review)", () => {
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
    bind: (item: number) => ({ main: c(item), side: { kind: "list", params: {} } }),
    // Split view's design shows both views: switching to it puts Side on screen.
    build: (item: number) =>
      row(
        pane(c(item), { id: "main", role: "main" }),
        pane({ kind: "list", params: {} }, { id: "side", role: "side" }),
      ),
  });
  const onPage = (o: Partial<JaliOptions> = {}) => {
    const location = memoryLocation();
    const jali = base({ page, features: [urlSync({ location })], ...o });
    jali.start();
    jali.page!.open();
    return { jali, location };
  };

  it("from Single view with open off, a drag or ⌥-click of a view Split view shows is refused, nothing changed", () => {
    const { jali, location } = onPage({ allow: { open: false } });
    const store = storeOf(jali);
    expect(jali.get().page?.mode).toBe("single");
    const layout = jali.getLayout(),
      entries = location.entries.length;
    expect(store.actions.placeTab("side", "main", "right")).toMatchObject({
      reason: "not-allowed",
    });
    expect(store.actions.showViewBeside("side")).toMatchObject({ reason: "not-allowed" });
    expect(jali.get().page?.mode).toBe("single");
    expect(jali.getLayout()).toBe(layout);
    expect(location.entries.length).toBe(entries);
    // What offers it agrees: no preview, no drop target, no hint.
    expect(besidePreview(store.snapshot(), "side")).toBeUndefined();
    expect(can(store, "placeTab", "side", "main", "right").ok).toBe(false);
    expect(can(store, "showViewBeside", "side").ok).toBe(false);
    // Choosing Split view itself stays anyone's, and shows the design.
    expect(jali.page!.setMode("split").ok).toBe(true);
    expect(jali.model().visible).toContain("side");
  });

  it("with open on, the same placement is previewed and made", () => {
    const { jali } = onPage();
    const store = storeOf(jali);
    expect(can(store, "showViewBeside", "side").ok).toBe(true);
    expect(store.actions.showViewBeside("side").ok).toBe(true);
    expect(jali.get().page?.mode).toBe("split");
    expect(jali.model().visible).toEqual(expect.arrayContaining(["main", "side"]));
  });
});
