/**
 * Jali inside a host's page: its landmarks leave the host's own alone, it mounts where there is no ResizeObserver, and
 * it says so in development when the host gave it no height.
 */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import type { JaliOptions } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";

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
    url: { location: memoryLocation() },
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
    expect(panes.classList.contains("jali-workspace")).toBe(true);
    // Pane headers are no banners.
    expect(screen.queryAllByRole("banner")).toHaveLength(0);
    expect(document.querySelector(".jali-pane-header")!.tagName).toBe("DIV");
  });

  it('is the page\'s <main> with landmark: "main"', () => {
    stubResizeObserver();
    render(<JaliRoot jali={make({ landmark: "main" })} />);
    const panes = screen.getByRole("main", { name: "Panes" });
    expect(panes.classList.contains("jali-workspace")).toBe(true);
    expect(screen.queryByRole("region", { name: "Panes" })).toBeNull();
  });
});
