/**
 * Tab features for apps with documents (Data Studio's request, 19 Nov 2026): the unsaved mark on a tab and wherever
 * else the pane is named, middle-click to close, and `confirmDiscard: false` for an app that asks itself.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row, runCommand, tabs } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import type { JaliOptions, LayoutInput } from "@jali/core";
import { JaliRoot, definePane, useUnsaved } from "@jali/react";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // jsdom lays nothing out: give the workspace the room its jali was made with, so nothing folds.
  for (const [prop, px] of [
    ["clientWidth", 1200],
    ["clientHeight", 600],
  ] as const)
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("jali-workspace") ? px : 0;
      },
    });
});
afterEach(cleanup);

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>note body {params.id}</p>,
});
const draft = definePane("draft", {
  params: { id: Number },
  title: ({ id }) => `Draft ${id}`,
  Component: () => {
    useUnsaved("a reply");
    return <p>draft body</p>;
  },
});

const make = (layout: LayoutInput, options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [note, draft],
    layout,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
    ...options,
  });

const tab = (name: string) => screen.getByRole("tab", { name });

describe("the unsaved mark", () => {
  it("marks a tab with unsaved work, and says so in its description", () => {
    const jali = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(draft({ id: 2 }), { id: "b" }))),
    );
    render(<JaliRoot jali={jali} />);
    const t = tab("Draft 2");
    expect(t.hasAttribute("data-unsaved")).toBe(true);
    expect(t.parentElement!.hasAttribute("data-unsaved")).toBe(true);
    expect(t.getAttribute("aria-description")).toBe("Unsaved changes. Delete closes it.");
    // The dot sits in the close button, which still closes.
    const close = within(t.parentElement!).getByRole("button", {
      name: "Close Draft 2",
      hidden: true,
    });
    expect(close.querySelector(".jali-unsaved")).not.toBeNull();
    expect(tab("Note 1").hasAttribute("data-unsaved")).toBe(false);
    expect(tab("Note 1").getAttribute("aria-description")).toBe("Delete closes it.");
  });

  it("names it on a lone pane's header", () => {
    const jali = make(row(pane(draft({ id: 2 }), { id: "b" }), pane(note({ id: 1 }), { id: "a" })));
    render(<JaliRoot jali={jali} />);
    const mark = screen.getByRole("img", { name: "Unsaved changes" });
    expect(mark.closest(".jali-pane-header")).not.toBeNull();
    expect(mark.closest("section")!.hasAttribute("data-unsaved")).toBe(true);
  });
});

describe("middle-click", () => {
  it("closes a tab the way its close button does", () => {
    const asked: string[] = [];
    const jali = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" }))),
      { beforeClose: (r) => (asked.push(`${r.reason}:${r.panes.map((p) => p.pane)}`), true) },
    );
    render(<JaliRoot jali={jali} />);
    act(
      () =>
        void fireEvent(
          tab("Note 2").parentElement!,
          new MouseEvent("auxclick", { bubbles: true, button: 1 }),
        ),
    );
    expect(asked).toEqual(["close:b"]);
    expect(jali.model().panes.map((p) => p.id)).toEqual(["a"]);
  });

  it("ignores other buttons", () => {
    const jali = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" }))),
    );
    render(<JaliRoot jali={jali} />);
    act(
      () =>
        void fireEvent(
          tab("Note 2").parentElement!,
          new MouseEvent("auxclick", { bubbles: true, button: 2 }),
        ),
    );
    expect(jali.model().panes).toHaveLength(2);
  });
});

describe("confirmDiscard: false", () => {
  const layout = row(pane(draft({ id: 2 }), { id: "b" }), pane(note({ id: 1 }), { id: "a" }));

  it("closes a pane with unsaved work once the app's beforeClose says yes, without Jali asking again", () => {
    const jali = make(layout, { confirmDiscard: false, beforeClose: () => true });
    render(<JaliRoot jali={jali} />);
    let r: ReturnType<typeof jali.actions.close> | undefined;
    act(() => void (r = jali.actions.close("b")));
    expect(r!.ok).toBe(true);
    expect(jali.model().panes.map((p) => p.id)).toEqual(["a"]);
    expect(screen.queryByText("Discard unsaved changes?")).toBeNull();
  });

  it("still shows the mark", () => {
    const jali = make(layout, { confirmDiscard: false });
    render(<JaliRoot jali={jali} />);
    expect(screen.getAllByRole("img", { name: "Unsaved changes" })).toHaveLength(1);
  });

  it("by default, Jali asks", () => {
    const jali = make(layout);
    render(<JaliRoot jali={jali} />);
    let r: ReturnType<typeof jali.actions.close> | undefined;
    act(() => void (r = jali.actions.close("b")));
    expect(r!.reason).toBe("unsaved");
    expect(jali.model().panes).toHaveLength(2);
  });
});

describe("reordering tabs", () => {
  const three = () =>
    make(
      row(
        tabs(
          pane(note({ id: 1 }), { id: "a" }),
          pane(note({ id: 2 }), { id: "b" }),
          pane(note({ id: 3 }), { id: "c" }),
        ),
        pane(note({ id: 9 }), { id: "z" }),
      ),
    );
  const order = (jali: ReturnType<typeof make>) =>
    (
      jali.getLayout().root as { children: { children?: { id: string }[] }[] }
    ).children[0]!.children!.map((c) => c.id);
  const said = (jali: ReturnType<typeof make>) => storeOf(jali).get().announcement.text;

  it("moves a tab to a position, clamped, and says where it went", () => {
    const jali = three();
    expect(jali.actions.moveTab("a", 2)).toEqual({ ok: true, pane: "a" });
    expect(order(jali)).toEqual(["b", "c", "a"]);
    expect(said(jali)).toBe("Note 1 moved to position 3 of 3");
    jali.actions.moveTab("a", -5);
    expect(order(jali)).toEqual(["a", "b", "c"]);
    jali.actions.moveTab("c", 99);
    expect(order(jali)).toEqual(["a", "b", "c"]);
  });

  it("keeps the shown tab shown", () => {
    const jali = three();
    jali.actions.focus("b");
    const active = () =>
      (jali.getLayout().root as { children: { active?: string }[] }).children[0]!.active;
    const before = active();
    jali.actions.moveTab("a", 1);
    expect(active()).toBe(before);
  });

  it("refuses a pane that is not a tab", () => {
    const jali = three();
    expect(jali.actions.moveTab("z", 0)).toMatchObject({ ok: false, reason: "nothing-to-do" });
  });

  it("moves the focused tab one place with the keys, and says so at the end", () => {
    const jali = three();
    jali.actions.focus("b");
    runCommand(jali, "tab.move.right");
    expect(order(jali)).toEqual(["a", "c", "b"]);
    runCommand(jali, "tab.move.right");
    expect(order(jali)).toEqual(["a", "c", "b"]);
    expect(said(jali)).toBe("Note 2 is already the last tab");
    runCommand(jali, "tab.move.left");
    expect(order(jali)).toEqual(["a", "b", "c"]);
  });

  it("reverses the keys right to left", () => {
    const jali = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" }))),
      { dir: "rtl" },
    );
    jali.actions.focus("a");
    runCommand(jali, "tab.move.left");
    expect(
      (
        jali.getLayout().root as { children: { children: { id: string }[] }[] }
      ).children[0]!.children.map((c) => c.id),
    ).toEqual(["b", "a"]);
  });

  it("can be bound to a single chord, after the app's prefix by default", () => {
    const jali = three();
    expect(jali.keymap.sequences("tab.move.left")).toHaveLength(1);
    const own = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" }))),
      {
        keyPrefix: "Mod+J",
        keymap: { "tab.move.right": "Alt+Shift+ArrowRight" },
      },
    );
    expect(own.keymap.label("tab.move.left")).toMatch(/J/);
    expect(own.keymap.sequences("tab.move.right")).toHaveLength(1);
    expect(own.keymap.sequences("tab.move.right")[0]!).toHaveLength(1);
  });
});

describe("a tab's menu", () => {
  const group = (options: Partial<JaliOptions> = {}) =>
    make(
      row(
        tabs(
          pane(note({ id: 1 }), { id: "a" }),
          pane(note({ id: 2 }), { id: "b" }),
          pane(note({ id: 3 }), { id: "c" }),
        ),
        pane(note({ id: 9 }), { id: "z" }),
      ),
      options,
    );
  const items = () =>
    screen
      .getAllByRole("menuitem")
      .map((i) => i.querySelector(".jali-tab-menu-title")!.textContent);

  it("opens on right-click with Jali's items for that tab, after a separator the app's", () => {
    const jali = group({
      tabMenu: ({ id }) =>
        id === "b"
          ? [
              { id: "dup", title: "Duplicate", run: () => {} },
              { id: "keep", title: "Pin tab", checked: false, run: () => {} },
            ]
          : undefined,
    });
    render(<JaliRoot jali={jali} />);
    fireEvent.contextMenu(tab("Note 2").parentElement!, { clientX: 100, clientY: 40 });
    const menu = screen.getByRole("menu", { name: "Note 2 tab" });
    expect(items()).toEqual([
      "Close",
      "Close other tabs",
      "Close tabs to the right",
      "Move tab left",
      "Move tab right",
      "Move out of tabs",
      "Maximise",
      "Duplicate",
    ]);
    expect(
      within(menu)
        .getByRole("menuitemcheckbox", { name: /Pin tab/ })
        .getAttribute("aria-checked"),
    ).toBe("false");
    expect(within(menu).getAllByRole("separator").length).toBeGreaterThan(0);
  });

  it("has no app group for a pane the app returns nothing for", () => {
    const jali = group({ tabMenu: () => [] });
    render(<JaliRoot jali={jali} />);
    fireEvent.contextMenu(tab("Note 3").parentElement!);
    expect(items().at(-1)).toBe("Maximise");
    // The last tab has nothing after it.
    expect(
      screen
        .getByRole("menuitem", { name: /Close tabs to the right/ })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("opens from the keyboard and Esc returns focus to the tab", () => {
    const jali = group();
    render(<JaliRoot jali={jali} />);
    const t = tab("Note 1");
    t.focus();
    fireEvent.keyDown(t, { key: "F10", shiftKey: true });
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(document.activeElement?.getAttribute("data-menu-item")).toBe("close");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement?.getAttribute("data-menu-item")).toBe("close-others");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(t);
  });

  it("closes the other tabs as one change: beforeClose asked once, listing them all", () => {
    const asked: string[][] = [];
    const jali = group({ beforeClose: (r) => (asked.push(r.panes.map((p) => p.pane)), true) });
    render(<JaliRoot jali={jali} />);
    fireEvent.contextMenu(tab("Note 2").parentElement!);
    act(() => void fireEvent.click(screen.getByRole("menuitem", { name: "Close other tabs" })));
    expect(asked).toEqual([["a", "c"]]);
    expect(
      jali
        .model()
        .panes.map((p) => p.id)
        .sort(),
    ).toEqual(["b", "z"]);
  });

  it("closes the tabs after one, and Undo brings them back", () => {
    const jali = group();
    expect(jali.actions.closeTabs("a", "after")).toMatchObject({ ok: true });
    expect(
      jali
        .model()
        .panes.map((p) => p.id)
        .sort(),
    ).toEqual(["a", "z"]);
    jali.actions.undo();
    expect(
      jali
        .model()
        .panes.map((p) => p.id)
        .sort(),
    ).toEqual(["a", "b", "c", "z"]);
    expect(jali.actions.closeTabs("z", "others")).toMatchObject({
      ok: false,
      reason: "nothing-to-do",
    });
  });

  it("does nothing for a disabled item", () => {
    const run = vi.fn();
    const jali = group({ tabMenu: () => [{ id: "x", title: "Not now", disabled: "Saving", run }] });
    render(<JaliRoot jali={jali} />);
    fireEvent.contextMenu(tab("Note 1").parentElement!);
    const item = screen.getByRole("menuitem", { name: "Not now" });
    expect(item.getAttribute("aria-description")).toBe("Saving");
    fireEvent.click(item);
    expect(run).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});
