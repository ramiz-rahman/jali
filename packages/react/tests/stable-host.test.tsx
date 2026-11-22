// @vitest-environment jsdom
/**
 * A pane's content never remounts while the pane stays (react-opus REACT-1, react-codex REACT-3): its component keeps
 * its state and its DOM when the workspace flips between tiled and single view, when a pane leaves a row that scrolls
 * sideways, and back. Each content renders once, in one place, into an element of its own that moves between frames.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { StrictMode, useEffect, useState } from "react";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";

const mounts: string[] = [];
function Counter({ id }: { id: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    mounts.push(id);
  }, [id]);
  return (
    <button type="button" data-counter={id} onClick={() => setN((x) => x + 1)}>
      {id}:{n}
    </button>
  );
}
const day = definePane("day", {
  params: { n: Number },
  title: ({ n }) => `Day ${n}`,
  width: { min: 300, comfortable: 360 },
  Component: ({ node }) => <Counter id={node.id} />,
});
const note = definePane("note", {
  params: { n: Number },
  title: ({ n }) => `Note ${n}`,
  width: { min: 280, comfortable: 300 },
  Component: ({ node }) => <Counter id={node.id} />,
});

let width = 1400;
const size = {
  clientWidth: () => width,
  clientHeight: () => 800,
  offsetWidth: () => width,
  offsetHeight: () => 800,
};
beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  for (const [k, get] of Object.entries(size))
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get });
  HTMLElement.prototype.scrollTo = () => {};
});
afterAll(() => {
  for (const k of Object.keys(size))
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
});
afterEach(() => {
  cleanup();
  mounts.length = 0;
  width = 1400;
});

const make = () =>
  createJali({
    panes: [day, note],
    layout: row(
      { id: "outer" },
      pane(note({ n: 1 }), { id: "left" }),
      row({ id: "week", scroll: "x" }, ...[1, 2, 3, 4].map((n) => pane(day({ n }), { id: `d${n}` }))),
    ),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    moveFocus: false,
  });

const counter = (id: string) => document.querySelector<HTMLElement>(`[data-counter="${id}"]`)!;
const resize = (w: number) =>
  act(() => {
    width = w;
    window.dispatchEvent(new Event("resize"));
  });

describe("a pane's content across responsive changes", () => {
  it("keeps its state and element from tiled to single view and back, in and out of a scrolling row", () => {
    const jali = make();
    render(
      <StrictMode>
        <JaliRoot jali={jali} />
      </StrictMode>,
    );
    expect(document.querySelector('.jali-strip [data-pane="d1"]')).not.toBeNull();
    fireEvent.click(counter("d1"));
    fireEvent.click(counter("left"));
    const el = counter("d1");
    const before = mounts.length;
    expect(counter("d1").textContent).toBe("d1:1");

    resize(400);
    expect(jali.model().single).toBe(true);
    expect(counter("d1").textContent).toBe("d1:1");
    expect(counter("left").textContent).toBe("left:1");
    expect(counter("d1")).toBe(el);

    resize(1400);
    expect(jali.model().single).toBe(false);
    expect(document.querySelector('.jali-strip [data-pane="d1"]')).not.toBeNull();
    expect(counter("d1").textContent).toBe("d1:1");
    expect(counter("d1")).toBe(el);

    act(() => void jali.actions.moveOutOfRow("d1"));
    expect(document.querySelector('.jali-strip [data-pane="d1"]')).toBeNull();
    expect(counter("d1").textContent).toBe("d1:1");
    expect(mounts.length).toBe(before);
  });

  it("content events still reach the pane: a press in it focuses the pane", () => {
    const jali = make();
    render(<JaliRoot jali={jali} />);
    fireEvent.pointerDown(counter("d2"));
    expect(jali.get().view.focused).toBe("d2");
  });
});
