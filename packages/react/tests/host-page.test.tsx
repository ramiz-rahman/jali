/**
 * Jali inside a host's page: its landmarks leave the host's own alone, it mounts where there is no ResizeObserver, and
 * it says so in development when the host gave it no height.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, render, screen } from "@testing-library/react";
import { GAP, createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import type { JaliOptions } from "@jali/core";
import { JaliRoot, JaliView, Shelf, definePane } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>note body {params.id}</p>,
});

const make = (options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [note],
    layout: row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
    ...options,
  });

/** A ResizeObserver that does nothing, for the tests that are not about it. */
const stubResizeObserver = () =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );

describe("landmarks", () => {
  it("is a labelled region by default, so a host's own <main> stays the only one", () => {
    stubResizeObserver();
    render(
      <main>
        <h1>Orders</h1>
        <JaliRoot jali={make()} />
      </main>,
    );
    expect(screen.getAllByRole("main")).toHaveLength(1);
    const panes = screen.getByRole("region", { name: "Panes" });
    expect(panes.tagName).toBe("SECTION");
    expect(panes.classList.contains("jali-layout")).toBe(true);
    // Pane headers are no banners.
    expect(screen.queryAllByRole("banner")).toHaveLength(0);
    expect(document.querySelector(".jali-pane-header")!.tagName).toBe("DIV");
  });

  it('is the page\'s <main> with landmark: "main"', () => {
    stubResizeObserver();
    render(<JaliRoot jali={make({ landmark: "main" })} />);
    const panes = screen.getByRole("main", { name: "Panes" });
    expect(panes.classList.contains("jali-layout")).toBe(true);
    expect(screen.queryByRole("region", { name: "Panes" })).toBeNull();
  });
});

describe("without ResizeObserver", () => {
  it("mounts the workspace and a tab strip with its folded chip, and measures on the window's resize instead", () => {
    // jsdom has none, and nothing here stubs it.
    expect(typeof globalThis.ResizeObserver).toBe("undefined");
    const jali = make();
    // jsdom lays nothing out, so the workspace measures 0 and the second pane folds: a tab strip and its "1 folded".
    render(
      <JaliRoot jali={jali}>
        <JaliView />
        <Shelf />
      </JaliRoot>,
    );
    expect(screen.getByRole("region", { name: "Panes" })).toBeTruthy();
    expect(screen.getAllByRole("tab").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "1 folded pane" })).toBeTruthy();

    // The fallback: a window resize measures the workspace again.
    const sizes = { clientWidth: 1000, clientHeight: 500 };
    const ws = document.querySelector<HTMLElement>(".jali-layout")!;
    for (const [k, v] of Object.entries(sizes)) Object.defineProperty(ws, k, { value: v });
    act(() => void window.dispatchEvent(new Event("resize")));
    expect(jali.get().area).toEqual({ width: 1000 - GAP * 2, height: 500 - GAP * 2 });
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });
});

describe("a workspace with no height", () => {
  const sized = (height: number) => {
    for (const [prop, px] of [
      ["clientWidth", 1000],
      ["clientHeight", height],
    ] as const)
      vi.spyOn(HTMLElement.prototype, prop, "get").mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("jali-layout") ? px : 0;
      });
  };

  it("warns in development when it measures 0 high after mount", () => {
    stubResizeObserver();
    sized(0);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<JaliRoot jali={make()} />);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/^Jali: the panes measure 0 pixels high/);
  });

  it("says nothing when it has a height, or when nothing is laid out (jsdom, a hidden root)", () => {
    stubResizeObserver();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<JaliRoot jali={make()} />);
    cleanup();
    sized(500);
    render(<JaliRoot jali={make()} />);
    expect(warn).not.toHaveBeenCalled();
  });
});
