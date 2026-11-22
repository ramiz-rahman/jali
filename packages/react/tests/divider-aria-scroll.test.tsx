// @vitest-environment jsdom
/**
 * A divider in a row that scrolls has no upper bound (the content grows), so it states none: no
 * `aria-valuemax="Infinity"`, which isn't a number. Found by Trips' axe scan (FINDINGS 12, 21 Nov 2026).
 */
import { afterAll, afterEach, beforeAll, expect, it } from "vite-plus/test";
import { cleanup, render } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";

const day = definePane("day", {
  params: { n: Number },
  title: ({ n }) => `Day ${n}`,
  width: { min: 300, comfortable: 360 },
  Component: () => null,
});

const size = { clientWidth: 1200, clientHeight: 800, offsetWidth: 1200, offsetHeight: 800 };
beforeAll(() => {
  globalThis.ResizeObserver = class {
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

it("a scrolling row's dividers state no maximum; a fitted row's state a number", () => {
  const jali = createJali({
    panes: [day],
    layout: row(
      { id: "outer" },
      row(
        { id: "week", scroll: "x" },
        ...[1, 2, 3, 4].map((n) => pane(day({ n }), { id: `d${n}` })),
      ),
      pane(day({ n: 9 }), { id: "side" }),
    ),
    url: { location: memoryLocation("") },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });
  const { container } = render(<JaliRoot jali={jali} />);
  const dividers = [...container.querySelectorAll('[role="separator"]')];
  expect(dividers.length).toBeGreaterThan(1);
  for (const d of dividers) {
    const max = d.getAttribute("aria-valuemax");
    if (max !== null) expect(Number.isFinite(Number(max))).toBe(true);
  }
  expect(dividers.some((d) => d.getAttribute("aria-valuemax") === null)).toBe(true);
});
