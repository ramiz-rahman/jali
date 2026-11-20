/**
 * Rows with one tab stop (APG roving tabindex): a pane's tab strip and the single-view pane switcher. ← and → move
 * focus in reading order and wrap both ways, Home and End go to the ends, and Enter or Space (or a click) selects:
 * moving never selects (manual activation).
 */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row, tabs } from "@jali/core";
import type { LayoutInput } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, definePane } from "@jali/react";

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

const make = (layout: LayoutInput, dir?: "rtl") =>
  createJali({
    panes: [note],
    layout,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
    ...(dir ? { dir } : {}),
  });

const three = () =>
  row(
    tabs(
      pane(note({ id: 1 }), { id: "a" }),
      pane(note({ id: 2 }), { id: "b" }),
      pane(note({ id: 3 }), { id: "c" }),
    ),
  );
const tab = (name: string) => screen.getByRole("tab", { name });
const key = (key: string, init: object = {}) =>
  fireEvent.keyDown(document.activeElement!, { key, ...init });

describe("a tab strip's keys", () => {
  it("move focus with ← and →, wrapping both ways, and Home and End, without selecting", () => {
    const jali = make(three());
    render(<JaliRoot jali={jali} />);
    act(() => tab("Note 1").focus());
    key("ArrowRight");
    expect(document.activeElement).toBe(tab("Note 2"));
    key("ArrowRight");
    key("ArrowRight");
    expect(document.activeElement).toBe(tab("Note 1"));
    key("ArrowLeft");
    expect(document.activeElement).toBe(tab("Note 3"));
    key("Home");
    expect(document.activeElement).toBe(tab("Note 1"));
    key("End");
    expect(document.activeElement).toBe(tab("Note 3"));
    // Moving never selects: the shown tab is still the first.
    expect(tab("Note 1").getAttribute("aria-selected")).toBe("true");
    expect(tab("Note 3").getAttribute("aria-selected")).toBe("false");
  });

  it("select the focused tab on Enter or Space (manual activation)", () => {
    const jali = make(three());
    render(<JaliRoot jali={jali} />);
    act(() => tab("Note 1").focus());
    key("ArrowRight");
    act(() => void key("Enter"));
    expect(tab("Note 2").getAttribute("aria-selected")).toBe("true");
    expect(tab("Note 2").tabIndex).toBe(0);
    expect(tab("Note 1").tabIndex).toBe(-1);
    // Showing a tab takes focus to its pane, as a click does; back on the strip, the walk goes on from there.
    act(() => tab("Note 2").focus());
    key("ArrowRight");
    act(() => void key(" "));
    expect(tab("Note 3").getAttribute("aria-selected")).toBe("true");
  });

  it("follow reading order right to left: ← moves forward", () => {
    const jali = make(three(), "rtl");
    render(<JaliRoot jali={jali} />);
    act(() => tab("Note 1").focus());
    key("ArrowLeft");
    expect(document.activeElement).toBe(tab("Note 2"));
    key("ArrowRight");
    key("ArrowRight");
    expect(document.activeElement).toBe(tab("Note 3"));
  });

  it("leave an arrow with a modifier to the keymap", () => {
    const jali = make(three());
    render(<JaliRoot jali={jali} />);
    act(() => tab("Note 1").focus());
    for (const mod of ["altKey", "shiftKey", "metaKey", "ctrlKey"])
      expect(key("ArrowRight", { [mod]: true })).toBe(true); // not prevented
    expect(document.activeElement).toBe(tab("Note 1"));
  });
});

describe("the pane switcher's keys", () => {
  const switcher = () => {
    room = { width: 200, height: 700 };
    const jali = make(
      row(
        pane(note({ id: 1 }), { id: "a" }),
        pane(note({ id: 2 }), { id: "b" }),
        pane(note({ id: 3 }), { id: "c" }),
      ),
    );
    render(<JaliRoot jali={jali} />);
    act(() => storeOf(jali).set({ area: { width: 200, height: 700 } }));
    const items = () => [...document.querySelectorAll<HTMLElement>(".jali-switch-item")];
    expect(items()).toHaveLength(3);
    return { jali, items };
  };

  it("wrap both ways, and Home and End go to the ends", () => {
    const { items } = switcher();
    act(() => items()[0]!.focus());
    key("ArrowLeft");
    expect(document.activeElement).toBe(items()[2]);
    key("ArrowRight");
    expect(document.activeElement).toBe(items()[0]);
    key("End");
    expect(document.activeElement).toBe(items()[2]);
    key("Home");
    expect(document.activeElement).toBe(items()[0]);
  });

  it("switch panes on Enter, not on an arrow", () => {
    const { jali, items } = switcher();
    act(() => items()[0]!.focus());
    key("ArrowRight");
    expect(storeOf(jali).get().view.focused).toBe("a");
    act(() => items()[1]!.click());
    expect(storeOf(jali).get().view.focused).toBe("b");
  });
});
