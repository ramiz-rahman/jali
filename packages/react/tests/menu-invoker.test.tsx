/**
 * Focus after a menu, and in rows that scroll (react-codex REACT-11): Escape or Tab in a pane's ⋯ menu gives focus back
 * to the ⋯ that opened it (the pane, if it is gone); a page tab or the phone switcher's item that takes focus scrolls
 * into its row.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";

afterEach(cleanup);

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});
const make = () =>
  createJali({
    panes: [note],
    layout: row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

describe("a pane's ⋯ menu", () => {
  const size = { clientWidth: 1200, clientHeight: 800 };
  beforeAll(() => {
    for (const [k, v] of Object.entries(size))
      Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
  });
  afterAll(() => {
    for (const k of Object.keys(size))
      delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
  });
  for (const key of ["Escape", "Tab"])
    it(`gives focus back to the ⋯ that opened it on ${key}`, () => {
      render(<JaliRoot jali={make()} />);
      const more = document.querySelector<HTMLElement>('[data-pane="b"] .jali-act-menu')!;
      act(() => more.focus());
      act(() => void fireEvent.click(more));
      const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
      expect(menu.contains(document.activeElement)).toBe(true);
      act(() => void fireEvent.keyDown(document.activeElement!, { key }));
      expect(document.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).toBe(more);
    });
});

describe("rows that scroll", () => {
  it("a switcher item that takes focus scrolls into its row", () => {
    const jali = createJali({
      panes: [note],
      layout: row(...[1, 2, 3, 4, 5, 6].map((id) => pane(note({ id }), { id: `n${id}` }))),
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 390, height: 800 },
      moveFocus: false,
    });
    const size = { clientWidth: 390, clientHeight: 800 };
    for (const [k, v] of Object.entries(size))
      Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
    try {
      render(<JaliRoot jali={jali} />);
    } finally {
      for (const k of Object.keys(size))
        delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
    }
    const list = document.querySelector<HTMLElement>(".jali-switch-list")!;
    const items = [...list.querySelectorAll<HTMLElement>('[role="tab"]')];
    const last = items.at(-1)!;
    list.getBoundingClientRect = () => ({ left: 0, right: 300 }) as DOMRect;
    last.getBoundingClientRect = () => ({ left: 500, right: 600 }) as DOMRect;
    list.scrollLeft = 0;
    act(() => void fireEvent.focus(last));
    expect(list.scrollLeft).toBe(300);
  });
});
