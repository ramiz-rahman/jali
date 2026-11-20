/**
 * Jali's menus share one behaviour (APG menu): focus goes in as one opens, ↓ ↑ wrap, Home and End go to the ends, Esc
 * closes it and gives focus back to what opened it. A tab's menu, the "N folded" chip's and the shelf's "+N" list
 * alike. And a menu portalled out of a pane's header never reaches the header's own handlers (QUALITY-REVIEW P7).
 */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row, tabs } from "@jali/core";
import type { LayoutInput } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, JaliView, Shelf, definePane } from "@jali/react";

let room = { width: 1200, height: 600 };
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  for (const prop of ["clientWidth", "clientHeight"] as const)
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        if (!this.classList.contains("jali-workspace")) return 0;
        return prop === "clientWidth" ? room.width : room.height;
      },
    });
});
afterEach(() => {
  cleanup();
  room = { width: 1200, height: 600 };
});

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>note body {params.id}</p>,
});

const make = (layout: LayoutInput) =>
  createJali({
    panes: [note],
    layout,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
    phone: { below: 0 },
  });

const press = (key: string, init: object = {}) =>
  fireEvent.keyDown(document.activeElement!, { key, ...init });
const items = () => screen.getAllByRole("menuitem");

describe("a tab's menu", () => {
  it("takes focus, wraps both ways, goes to the ends, and gives focus back to the tab on Esc", () => {
    const jali = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" }))),
    );
    render(<JaliRoot jali={jali} />);
    const tab = screen.getByRole("tab", { name: "Note 1" });
    act(() => tab.focus());
    act(() => void press("F10", { shiftKey: true }));
    const all = items();
    expect(document.activeElement).toBe(all[0]);
    press("ArrowUp");
    expect(document.activeElement).toBe(all.at(-1));
    press("ArrowDown");
    expect(document.activeElement).toBe(all[0]);
    press("End");
    expect(document.activeElement).toBe(all.at(-1));
    press("Home");
    expect(document.activeElement).toBe(all[0]);
    act(() => void press("Escape"));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(tab);
  });
});

describe("the folded chip's menu", () => {
  it("starts on the pane shown, and gives focus back to the chip on Esc", () => {
    const jali = make(
      row(
        pane(note({ id: 1 }), { id: "a" }),
        pane(note({ id: 2 }), { id: "b" }),
        pane(note({ id: 3 }), { id: "c" }),
      ),
    );
    render(<JaliRoot jali={jali} />);
    room = { width: 360, height: 600 };
    act(() => storeOf(jali).set({ area: { width: 360, height: 600 } }));
    const chip = document.querySelector<HTMLElement>(".jali-tab-folded")!;
    expect(chip).toBeTruthy();
    act(() => chip.focus());
    act(() => chip.click());
    expect(screen.getByRole("menu").contains(document.activeElement)).toBe(true);
    expect(items()).toContain(document.activeElement);
    act(() => void press("Escape"));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(chip);
  });
});

describe("the shelf's +N list", () => {
  it("is a menu: focus goes in, the arrows move, Esc gives focus back to +N", () => {
    const jali = make(
      row(
        pane(note({ id: 1 }), { id: "a" }),
        pane(note({ id: 2 }), { id: "b" }),
        pane(note({ id: 3 }), { id: "c" }),
      ),
    );
    // Every chip lies past the shelf's end: all of them are in the +N list.
    const rect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const left = this instanceof HTMLElement && this.dataset.chip ? 500 : 0;
      return { left, right: left + 100, top: 0, bottom: 20, width: 100, height: 20 } as DOMRect;
    };
    try {
      render(
        <JaliRoot jali={jali}>
          <JaliView />
          <Shelf />
        </JaliRoot>,
      );
      act(() => {
        jali.actions.tuck("b");
        jali.actions.tuck("c");
      });
      const more = document.querySelector<HTMLElement>(".jali-shelf-more")!;
      expect(more).toBeTruthy();
      act(() => more.focus());
      act(() => more.click());
      const all = items();
      expect(all).toHaveLength(2);
      expect(all.every((el) => el.tabIndex === -1)).toBe(true);
      expect(document.activeElement).toBe(all[0]);
      press("ArrowDown");
      expect(document.activeElement).toBe(all[1]);
      press("ArrowDown");
      expect(document.activeElement).toBe(all[0]);
      act(() => void press("Escape"));
      expect(screen.queryByRole("menu")).toBeNull();
      expect(document.activeElement).toBe(more);
    } finally {
      Element.prototype.getBoundingClientRect = rect;
    }
  });
});

describe("a menu opened from a pane's header", () => {
  const open = () => {
    // A tab's menu: rendered by the tab strip, inside the header, and portalled out of it.
    const jali = make(
      row(
        tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
        pane(note({ id: 3 }), { id: "c" }),
      ),
    );
    render(<JaliRoot jali={jali} />);
    const header = document.querySelector<HTMLElement>('[data-pane="a"] .jali-pane-header')!;
    const tab = screen.getByRole("tab", { name: "Note 1" });
    act(() => void fireEvent.contextMenu(tab, { clientX: 20, clientY: 20 }));
    const menu = screen.getByRole("menu");
    expect(header.contains(menu)).toBe(false); // portalled out of it
    return { jali, header, separator: menu.querySelector<HTMLElement>('[role="separator"]')! };
  };
  const dragging = () => document.body.classList.contains("jali-pane-dragging");
  const drag = (from: HTMLElement) => {
    fireEvent.pointerDown(from, { button: 0, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 120 });
    const was = dragging();
    fireEvent.pointerUp(window, { clientX: 120, clientY: 120 });
    return was;
  };

  it("never drags the pane on a press in the menu", () => {
    const { header, separator } = open();
    expect(separator).toBeTruthy();
    expect(drag(separator)).toBe(false);
    // The header itself still drags.
    expect(drag(header)).toBe(true);
  });

  it("never maximises the pane on a double-click in the menu", () => {
    const { jali, separator } = open();
    act(() => void fireEvent.doubleClick(separator));
    expect(storeOf(jali).get().view.zoomed).toBeFalsy();
  });
});
