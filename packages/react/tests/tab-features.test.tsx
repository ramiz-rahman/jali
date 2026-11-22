/**
 * Tab features for apps with documents (Data Studio's request, 19 Nov 2026): the unsaved mark on a tab and wherever
 * else the pane is named, middle-click to close, and `confirmDiscard: false` for an app that asks itself.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row, runCommand, tabs } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import type { JaliOptions, LayoutInput } from "@jali/core";
import { JaliRoot, definePane, useTitle, useUnsaved } from "@jali/react";

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
      jali.getLayout().root as unknown as { children: { children?: { id: string }[] }[] }
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
      (jali.getLayout().root as unknown as { children: { active?: string }[] }).children[0]!.active;
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
        jali.getLayout().root as unknown as { children: { children: { id: string }[] }[] }
      ).children[0]!.children.map((c) => c.id),
    ).toEqual(["b", "a"]);
  });

  it("can be bound to a single chord, after the app's prefix by default", () => {
    const jali = three();
    expect(jali.keymap.sequences("tab.move.left")).toHaveLength(1);
    const own = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" }))),
      {
        keyboard: { prefix: "Mod+J", keymap: { "tab.move.right": "Alt+Shift+ArrowRight" } },
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
              { id: "watch", title: "Watch", checked: false, run: () => {} },
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
      "Full screen",
      "Duplicate",
    ]);
    expect(
      within(menu).getByRole("menuitemcheckbox", { name: /Watch/ }).getAttribute("aria-checked"),
    ).toBe("false");
    expect(within(menu).getAllByRole("separator").length).toBeGreaterThan(0);
  });

  it("has no app group for a pane the app returns nothing for", () => {
    const jali = group({ tabMenu: () => [] });
    render(<JaliRoot jali={jali} />);
    fireEvent.contextMenu(tab("Note 3").parentElement!);
    expect(items().at(-1)).toBe("Full screen");
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

describe("pinned tabs", () => {
  const four = (options: Partial<JaliOptions> = {}) =>
    make(
      row(
        tabs(
          pane(note({ id: 1 }), { id: "a" }),
          pane(note({ id: 2 }), { id: "b" }),
          pane(note({ id: 3 }), { id: "c" }),
          pane(note({ id: 4 }), { id: "d" }),
        ),
        pane(note({ id: 9 }), { id: "z" }),
      ),
      options,
    );
  const order = (jali: ReturnType<typeof make>) =>
    (
      jali.getLayout().root as unknown as { children: { children?: { id: string }[] }[] }
    ).children[0]!.children!.map((c) => c.id);

  it("go first in their group, in the order they were pinned", () => {
    const jali = four();
    jali.actions.setPinned("c", true);
    jali.actions.setPinned("d", true);
    expect(order(jali)).toEqual(["c", "d", "a", "b"]);
    jali.actions.setPinned("c", false);
    expect(order(jali)).toEqual(["d", "c", "a", "b"]);
  });

  it("tell the app once per change, and pinning a pinned tab is no change", () => {
    const heard: unknown[] = [];
    const jali = four();
    // Only what changed: `input` depends on what earlier tests in this task pressed (event-input.test.ts covers it).
    jali.on("pin", ({ pane, pinned }) => heard.push({ pane, pinned }));
    const layouts: unknown[] = [];
    jali.on("layout", (e) => layouts.push(e));
    jali.actions.setPinned("b", true);
    expect(jali.actions.setPinned("b", true)).toMatchObject({ ok: true });
    expect(heard).toEqual([{ pane: "b", pinned: true }]);
    expect(layouts).toHaveLength(1);
  });

  it("are left open by Close other tabs and Close tabs to the right", () => {
    const jali = four();
    jali.actions.setPinned("d", true);
    jali.actions.closeTabs("a", "others");
    expect(order(jali)).toEqual(["d", "a"]);
  });

  it("move only among themselves, and the others only after them", () => {
    const jali = four();
    jali.actions.setPinned("a", true);
    jali.actions.moveTab("a", 3);
    expect(order(jali)).toEqual(["a", "b", "c", "d"]);
    jali.actions.moveTab("d", 0);
    expect(order(jali)).toEqual(["a", "d", "b", "c"]);
  });

  it("show a pin and say they are pinned; the menu has Pin tab, ticked", () => {
    const jali = four();
    jali.actions.setPinned("b", true);
    render(<JaliRoot jali={jali} />);
    const t = tab("Note 2");
    expect(t.hasAttribute("data-pinned")).toBe(true);
    expect(t.getAttribute("aria-description")).toMatch(/^Pinned\. /);
    fireEvent.contextMenu(t.parentElement!);
    const pin = screen.getByRole("menuitemcheckbox", { name: "Pin tab" });
    expect(pin.getAttribute("aria-checked")).toBe("true");
    act(() => void fireEvent.click(pin));
    expect(jali.model().pane("b")).not.toHaveProperty("pinned");
  });

  it("survive a link: the codec carries them", () => {
    const jali = four();
    jali.actions.setPinned("c", true);
    const again = make(jali.getLayout());
    expect(again.model().pane("c")?.pinned).toBe(true);
  });
});

describe("renaming in place", () => {
  const names: Record<string, string> = {};
  const doc = definePane("doc", {
    params: { id: Number },
    title: ({ id }) => `Doc ${id}`,
    Component: ({ params }) => {
      useTitle(names[params.id] ?? null);
      return <p>doc {params.id}</p>;
    },
  });
  const docs = (rename: JaliOptions["rename"], layout?: LayoutInput) =>
    createJali({
      panes: [note, doc],
      layout:
        layout ??
        row(
          tabs(pane(doc({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
          pane(doc({ id: 3 }), { id: "c" }),
        ),
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 1200, height: 600 },
      moveFocus: false,
      ...(rename ? { rename } : {}),
    });
  const field = () => screen.getByRole("textbox") as HTMLInputElement;

  it("opens on a tab's double-click with the title selected; Enter saves through the app, focus back on the tab", async () => {
    const saved: string[] = [];
    const jali = docs({
      can: ({ ref }) => ref.kind === "doc",
      run: ({ ref }, text) => {
        saved.push(text);
        names[ref.params.id as number] = text;
      },
    });
    const { rerender } = render(<JaliRoot jali={jali} />);
    fireEvent.doubleClick(tab("Doc 1"));
    expect(field().value).toBe("Doc 1");
    expect(field().getAttribute("aria-label")).toBe("Rename Doc 1");
    fireEvent.change(field(), { target: { value: "  Orders by region " } });
    await act(async () => void fireEvent.keyDown(field(), { key: "Enter" }));
    expect(saved).toEqual(["Orders by region"]);
    expect(screen.queryByRole("textbox")).toBeNull();
    rerender(<JaliRoot jali={jali} />);
    delete names[1];
  });

  it("is offered only where `can` says so, and never without `rename`", () => {
    const jali = docs({ can: ({ ref }) => ref.kind === "doc", run: () => {} });
    render(<JaliRoot jali={jali} />);
    fireEvent.doubleClick(tab("Note 2"));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(jali.actions.startRename("b")).toMatchObject({ ok: false, reason: "unavailable" });
    expect(docs(undefined).actions.startRename("a")).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
    fireEvent.contextMenu(tab("Note 2").parentElement!);
    expect(screen.queryByRole("menuitem", { name: /Rename/ })).toBeNull();
  });

  it("opens from the app, on a lone pane's title, and Esc keeps the old name", () => {
    const run = vi.fn();
    const jali = docs({ run });
    render(<JaliRoot jali={jali} />);
    act(() => void jali.actions.startRename("c"));
    expect(field().closest("h2")).not.toBeNull();
    fireEvent.change(field(), { target: { value: "Other" } });
    fireEvent.keyDown(field(), { key: "Escape" });
    expect(run).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("stays open with the text when the app says no", async () => {
    const jali = docs({ run: () => false });
    render(<JaliRoot jali={jali} />);
    act(() => void jali.actions.startRename("a"));
    fireEvent.change(field(), { target: { value: "Taken" } });
    await act(async () => void fireEvent.keyDown(field(), { key: "Enter" }));
    expect(field().value).toBe("Taken");
    expect(field().getAttribute("aria-invalid")).toBe("true");
  });

  it("saves nothing for an empty or unchanged name", async () => {
    const run = vi.fn();
    const jali = docs({ run });
    render(<JaliRoot jali={jali} />);
    act(() => void jali.actions.startRename("a"));
    fireEvent.change(field(), { target: { value: "   " } });
    await act(async () => void fireEvent.keyDown(field(), { key: "Enter" }));
    expect(run).not.toHaveBeenCalled();
  });

  it("is F2 on the focused pane, unless the app reserves F2", () => {
    expect(docs({ run: () => {} }).keymap.label("pane.rename")).toBe("F2");
    const own = createJali({
      panes: [doc],
      layout: row(doc({ id: 1 })),
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      keyboard: { reserved: ["F2"], onInvalid: () => {} },
      rename: { run: () => {} },
    });
    expect(own.keymap.label("pane.rename")).toBe("");
  });

  it("is in the tab's menu", () => {
    const jali = docs({ run: () => {} });
    render(<JaliRoot jali={jali} />);
    fireEvent.contextMenu(tab("Doc 1").parentElement!);
    act(() => void fireEvent.click(screen.getByRole("menuitem", { name: /Rename/ })));
    expect(field().value).toBe("Doc 1");
  });
});
