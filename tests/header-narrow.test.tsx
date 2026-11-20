/**
 * The pane header gives way before its title does: in a header too narrow for the shown title's first few characters,
 * tuck, maximise, full screen and pop out move into the pane's menu (where they keep their names and keys), then the
 * pane's own controls (useHeaderActions) are hidden and the menu lists the pane's commands. `data-narrow` says how
 * far; `data-count` on the buttons says how many show. jsdom lays nothing out, so the test says how wide things are;
 * its h2 is 24px, so "a few characters" (3em) is 72px here.
 */
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { JaliRoot, definePane, useCommands, useHeaderActions } from "@jali/react";
import { useState } from "react";

/** The header's width, and the shown title's: the room it has and the width its whole text wants. */
let room = { header: 600, title: 200, wants: 120 };
/** The title's room once Jali's buttons have moved, so a test can stop at the first step. */
let roomActionsMoved: number | null = null;
const observers = new Set<() => void>();
const resize = () => act(() => observers.forEach((fn) => fn()));

const props = ["clientWidth", "clientHeight", "scrollWidth"] as const;
beforeAll(() => {
  globalThis.ResizeObserver = class {
    fn: () => void;
    constructor(fn: () => void) {
      this.fn = () => fn();
    }
    observe() {
      observers.add(this.fn);
    }
    unobserve() {}
    disconnect() {
      observers.delete(this.fn);
    }
  } as unknown as typeof ResizeObserver;
  const size = (el: HTMLElement, prop: "clientWidth" | "clientHeight" | "scrollWidth") => {
    if (el.classList.contains("jali-workspace")) return prop === "clientHeight" ? 600 : 1200;
    if (prop === "clientHeight") return 0;
    if (el.classList.contains("jali-pane-header")) return prop === "clientWidth" ? room.header : 0;
    if (el.tagName === "H2" && el.closest(".jali-pane-title")) {
      if (prop === "scrollWidth") return room.wants;
      const header = el.closest<HTMLElement>(".jali-pane-header");
      return header?.dataset.narrow === "actions" && roomActionsMoved !== null
        ? roomActionsMoved
        : room.title;
    }
    return 0;
  };
  for (const prop of props) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return size(this, prop);
      },
    });
  }
});
afterAll(() => {
  // The prototype's own getters are jsdom's (on Element): removing ours brings them back.
  for (const prop of props)
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
});
afterEach(() => {
  cleanup();
  observers.clear();
  room = { header: 600, title: 200, wants: 120 };
  roomActionsMoved = null;
});

const added = vi.fn();
/** A list of markers whose header holds its own Add button, with Add also a command. */
const markers = definePane("markers", {
  title: () => "Markers of the long session",
  Component: () => {
    const [shown, setShown] = useState(true);
    useCommands([{ id: "add", title: "Add a marker", keys: "M", run: added }]);
    useHeaderActions(
      shown ? (
        <button type="button" onClick={added}>
          Add
        </button>
      ) : null,
    );
    return (
      <button type="button" onClick={() => setShown(false)}>
        Hide the controls
      </button>
    );
  },
});
const note = definePane("note", { title: () => "Note", Component: () => <p>note</p> });

const make = () =>
  createJali({
    panes: [markers, note],
    layout: row(pane(markers(), { id: "m" }), pane(note(), { id: "n" })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
    phone: { below: 0 },
  });

const headerOf = (id: string) =>
  document.querySelector<HTMLElement>(`[data-pane="${id}"] .jali-pane-header`)!;
const actionsOf = (id: string) =>
  [...headerOf(id).querySelectorAll<HTMLElement>(".jali-pane-actions .jali-pane-action")].map(
    (b) => b.dataset.action,
  );

describe("a narrow header keeps its title", () => {
  it("at normal widths nothing changes: no data-narrow, Jali's buttons and ⋯ (Full screen is in the menu), and data-count", () => {
    render(<JaliRoot jali={make()} />);
    const h = headerOf("n");
    expect(h.dataset.narrow).toBeUndefined();
    expect(actionsOf("n")).toEqual(["tuck", "zoom", "menu", "close"]);
    expect(h.querySelector(".jali-pane-actions")!.getAttribute("data-count")).toBe("4");
  });

  it("moves tuck and maximise into the pane's menu before the title is cut below a few characters, and takes them back", () => {
    render(<JaliRoot jali={make()} />);
    // The title is cut, but still has its first few characters: nothing moves.
    room = { header: 300, title: 80, wants: 120 };
    resize();
    expect(headerOf("n").dataset.narrow).toBeUndefined();
    // Cut to two or three characters: Jali's buttons give way, Close stays, and ⋯ holds the rest.
    room = { header: 200, title: 20, wants: 120 };
    resize();
    const h = headerOf("n");
    expect(h.dataset.narrow).toBe("actions");
    expect(actionsOf("n")).toEqual(["menu", "close"]);
    expect(h.querySelector(".jali-pane-actions")!.getAttribute("data-count")).toBe("2");
    // They keep their names and are reached from the keyboard in the menu.
    fireEvent.click(within(h).getByRole("button", { name: /^More/ }));
    const menu = screen.getByRole("menu");
    const zoom = within(menu).getByRole("menuitem", { name: /Maximise/ });
    expect(within(menu).getByRole("menuitem", { name: /Tuck/ })).toBeTruthy();
    act(() => zoom.focus());
    fireEvent.keyDown(zoom, { key: "Enter" });
    expect(document.querySelector('[data-pane="n"]')!.hasAttribute("data-zoomed")).toBe(true);
  });

  it("takes them back once the header is wide enough for the title's few characters with them, not before", () => {
    render(<JaliRoot jali={make()} />);
    room = { header: 200, title: 20, wants: 120 };
    resize();
    expect(headerOf("n").dataset.narrow).toBe("actions");
    // A pixel wider is not enough: the title would be cut short again.
    room = { header: 201, title: 21, wants: 120 };
    resize();
    expect(headerOf("n").dataset.narrow).toBe("actions");
    room = { header: 600, title: 200, wants: 120 };
    resize();
    expect(headerOf("n").dataset.narrow).toBeUndefined();
    expect(actionsOf("n")).toEqual(["tuck", "zoom", "menu", "close"]);
  });
});

describe("useHeaderActions", () => {
  it("puts the pane's controls in its header after the title and before Jali's buttons", () => {
    render(<JaliRoot jali={make()} />);
    const h = headerOf("m");
    const tools = h.querySelector<HTMLElement>(".jali-pane-tools")!;
    const add = within(tools).getByRole("button", { name: "Add" });
    const title = h.querySelector(".jali-pane-title")!;
    const actions = h.querySelector(".jali-pane-actions")!;
    expect(title.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(tools.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    added.mockClear();
    fireEvent.click(add);
    expect(added).toHaveBeenCalledOnce();
    // A pane without controls draws no slot (so no empty gap).
    expect(headerOf("n").querySelector(".jali-pane-tools")).toBeNull();
  });

  it("null takes them away", () => {
    render(<JaliRoot jali={make()} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide the controls" }));
    expect(headerOf("m").querySelector(".jali-pane-tools")).toBeNull();
  });

  it("a narrow header keeps them while Jali's buttons can give way, then hides them and lists the pane's commands in its menu", () => {
    render(<JaliRoot jali={make()} />);
    // Moving Jali's buttons is enough: the controls stay.
    room = { header: 200, title: 20, wants: 120 };
    roomActionsMoved = 80;
    resize();
    let h = headerOf("m");
    expect(h.dataset.narrow).toBe("actions");
    expect(h.querySelector(".jali-pane-tools")).not.toBeNull();
    // Still too narrow: the controls go, and their command is in the menu.
    roomActionsMoved = 20;
    resize();
    h = headerOf("m");
    expect(h.dataset.narrow).toBe("tools");
    expect(h.querySelector(".jali-pane-tools")).toBeNull();
    fireEvent.click(within(h).getByRole("button", { name: /^More/ }));
    added.mockClear();
    const item = within(screen.getByRole("menu")).getByRole("menuitem", { name: /Add a marker/ });
    act(() => item.focus());
    fireEvent.keyDown(item, { key: "Enter" });
    expect(added).toHaveBeenCalledOnce();
    // Wide again: the controls come back.
    room = { header: 900, title: 300, wants: 120 };
    roomActionsMoved = null;
    resize();
    resize();
    expect(headerOf("m").dataset.narrow).toBeUndefined();
    expect(headerOf("m").querySelector(".jali-pane-tools button")).not.toBeNull();
  });
});
