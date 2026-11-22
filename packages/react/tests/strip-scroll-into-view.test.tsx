// @vitest-environment jsdom
/**
 * A row that scrolls sideways brings panes into view: the focused one, and one that joins the row, opened beside a
 * pane in it while focus stays at the source. The browser does the scrolling (Scroller asks the strip's element to
 * `scrollTo`), so these check what it is asked to show.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, render } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

const day = definePane("day", {
  params: { n: Number },
  title: ({ n }) => `Day ${n}`,
  width: { min: 300, comfortable: 360 },
  Component: () => null,
});
const note = definePane("note", {
  params: { n: Number },
  title: ({ n }) => `Note ${n}`,
  width: { min: 280, comfortable: 300 },
  Component: () => null,
});

const size = { clientWidth: 1200, clientHeight: 800, offsetWidth: 1200, offsetHeight: 800 };
let scrolled: { left?: number }[] = [];
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  for (const [k, v] of Object.entries(size))
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
  HTMLElement.prototype.scrollTo = vi.fn(function (
    this: HTMLElement,
    o?: ScrollToOptions | number,
  ) {
    if (this.classList.contains("jali-strip-viewport") && typeof o === "object") scrolled.push(o);
  }) as unknown as HTMLElement["scrollTo"];
});
afterAll(() => {
  for (const k of Object.keys(size))
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
});
afterEach(() => {
  cleanup();
  scrolled = [];
});

// The workspace is 1200 wide (less its insets); the week's window shows days 1 to 3, the fourth past its edge.
const make = () =>
  createJali({
    panes: [day, note],
    layout: row(
      { id: "outer" },
      row(
        { id: "week", scroll: "x" },
        ...[1, 2, 3, 4, 5, 6].map((n) => pane(day({ n }), { id: `d${n}` })),
      ),
    ),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

describe("a row that scrolls brings panes into view", () => {
  it("a pane opened beside the last one in view scrolls in, while focus stays at its source", () => {
    const jali = make();
    render(<JaliRoot jali={jali} />);
    const window = jali.model().content.scrollers[0]!.rect.width;
    act(() => void jali.actions.focus("d3"));
    scrolled = [];
    let opened: string | undefined;
    act(() => {
      opened = jali.actions.openBeside("d3", note({ n: 1 })).pane;
    });
    expect(jali.get().view.focused).toBe("d3");
    const box = jali.model().content.panes.find((b) => b.id === opened)!.rect;
    const strip = jali.model().content.scrollers[0]!;
    // Scrolled so the new pane's end meets the window's: the pane whole, and its source beside it when both fit.
    expect(scrolled.at(-1)?.left).toBeCloseTo(box.x + box.width - strip.rect.x - window, 0);
  });

  it("focus on a pane out of view scrolls to it", () => {
    const jali = make();
    render(<JaliRoot jali={jali} />);
    act(() => void jali.actions.focus("d6"));
    const strip = jali.model().content.scrollers[0]!;
    const box = jali.model().content.panes.find((b) => b.id === "d6")!.rect;
    expect(scrolled.at(-1)?.left).toBeCloseTo(
      box.x + box.width - strip.rect.x - strip.rect.width,
      0,
    );
  });
});
