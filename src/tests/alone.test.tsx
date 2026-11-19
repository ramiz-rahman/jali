/**
 * A lone pane: with one pane on screen the chrome is as quiet as a plain tab strip (Data Studio's ask). Full-bleed, no
 * tuck or maximise, and no header close while its tabs carry their own ×. A second pane brings it all back.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, tabs } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>Note {params.id}</p>,
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

const make = (layout: Parameters<typeof createJali>[0]["layout"]) =>
  createJali({
    panes: [note],
    layout,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

describe("a lone pane", () => {
  it("is full-bleed, with no tuck, maximise or header close while its tabs have their own", () => {
    const { container } = render(<JaliRoot jali={make(tabs(note({ id: 1 }), note({ id: 2 })))} />);
    const pane = container.querySelector<HTMLElement>(".jali-pane:not([style*='none'])")!;
    expect(pane.dataset.alone).toBe("true");
    expect(container.querySelector(".jali-workspace")!.hasAttribute("data-alone")).toBe(true);
    // The whole workspace: no inset around a lone pane.
    expect(pane.style.width).toBe("1200px");
    // The shown pane's header (the tab behind it is hidden and draws no header of its own).
    expect(pane.querySelector(".jali-act-tuck, .jali-act-zoom, .jali-act-close")).toBeNull();
    expect(pane.querySelector(".jali-tab-item .jali-tab-close")).not.toBeNull();
  });

  it("keeps its close button when it has no tabs to close it from", () => {
    const { container } = render(<JaliRoot jali={make(note({ id: 1 }))} />);
    expect(container.querySelector(".jali-act-close")).not.toBeNull();
    expect(container.querySelector(".jali-act-tuck")).toBeNull();
  });

  it("gets its island and buttons back when a second pane opens", () => {
    const jali = make(note({ id: 1 }));
    const { container } = render(<JaliRoot jali={jali} />);
    act(() => void jali.actions.openBeside(jali.model().visible[0]!, note({ id: 2 })));
    expect(container.querySelector("[data-alone]")).toBeNull();
    expect(container.querySelectorAll(".jali-act-tuck").length).toBe(2);
  });
});
