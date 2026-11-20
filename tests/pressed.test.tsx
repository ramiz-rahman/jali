/** data-pressed (packages/react/src/pressed.ts): on Jali's controls while held, by the pointer or by Space or Enter. */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, row, tabs } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";
import { parts } from "../packages/react/src/parts";
import { PRESSABLE } from "../packages/react/src/pressed";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <button>Inside {params.id}</button>,
});

const make = () =>
  createJali({
    panes: [note],
    layout: row(note({ id: 1 }), tabs(note({ id: 2 }), note({ id: 3 }))),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

const size = { clientWidth: 1200, clientHeight: 800 };
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  for (const [k, v] of Object.entries(size))
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
});
afterAll(() => {
  for (const k of Object.keys(size))
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
});
afterEach(cleanup);

describe("data-pressed", () => {
  it("is on a header button while the pointer holds it, and goes when it lets go", () => {
    const { container } = render(<JaliRoot jali={make()} />);
    const close = container.querySelector<HTMLElement>('.jali-pane-action[data-action="close"]')!;
    act(() => void fireEvent.pointerDown(close, { button: 0, isPrimary: true }));
    expect(close.hasAttribute("data-pressed")).toBe(true);
    act(() => void fireEvent.pointerUp(close, { button: 0, isPrimary: true }));
    expect(close.hasAttribute("data-pressed")).toBe(false);
  });

  it("is on a tab while Space holds it, and goes on keyup or when focus leaves", () => {
    const { container } = render(<JaliRoot jali={make()} />);
    const tab = container.querySelector<HTMLElement>(".jali-tab")!;
    tab.focus();
    act(() => void fireEvent.keyDown(tab, { key: " " }));
    expect(tab.hasAttribute("data-pressed")).toBe(true);
    act(() => void fireEvent.keyUp(tab, { key: " " }));
    expect(tab.hasAttribute("data-pressed")).toBe(false);
    act(() => void fireEvent.keyDown(tab, { key: "Enter" }));
    expect(tab.hasAttribute("data-pressed")).toBe(true);
    act(() => void fireEvent.focusOut(tab));
    expect(tab.hasAttribute("data-pressed")).toBe(false);
  });

  it("is never on the app's own controls inside a pane", () => {
    const { container } = render(<JaliRoot jali={make()} />);
    const inside = [...container.querySelectorAll<HTMLElement>(".jali-pane-content button")][0]!;
    act(() => void fireEvent.pointerDown(inside, { button: 0, isPrimary: true }));
    expect(container.querySelector("[data-pressed]")).toBeNull();
  });

  it("goes to exactly the parts that list it", () => {
    const listed = Object.values(parts)
      .filter((p) => p.attributes.some((a) => a.name === "data-pressed"))
      .map((p) => p.selector)
      .sort();
    expect(PRESSABLE.split(", ").sort()).toEqual(listed);
  });
});
