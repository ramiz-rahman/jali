/**
 * What may happen to a pane (`allow`): the kind's, then the workspace's, and its `when`. The actions refuse, whatever
 * asks; the header, the tab's × and its menu, and ⌘K offer only what is allowed.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, tabs, type Allow } from "@jali/core";
import type { Feature } from "@jali/core";
import {
  allows,
  commandDefsOf,
  dividerAllowed,
  STEPS,
  storeOf,
  tabMenuOf,
} from "@jali/core/adapter";
import { JaliRoot, definePane } from "@jali/react";
import { defaultFeatures, popOut, urlSync } from "./features";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});
const board = definePane("board", {
  title: () => "Board",
  allow: { close: false, fullScreen: false },
  Component: () => null,
});

const make = (allow?: Allow, more: Feature[] = []) =>
  createJali({
    panes: [note, board],
    layout: row(
      pane(board(), { id: "board" }),
      tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
    ),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() }), ...more],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...(allow ? { allow } : {}),
  });

describe("allow", () => {
  it("allows everything by default; Pop out with its feature, unless the app turns it off", () => {
    const x = storeOf(make()).snapshot();
    expect(allows(x, "a", "close")).toBe(true);
    expect(allows(x, "a", "popOut")).toBe(false);
    expect(allows(storeOf(make(undefined, [popOut()])).snapshot(), "a", "popOut")).toBe(true);
    expect(allows(storeOf(make({ popOut: false }, [popOut()])).snapshot(), "a", "popOut")).toBe(
      false,
    );
  });

  it("a kind's `false` refuses its action, from any route, saying why", () => {
    const jali = make();
    expect(jali.actions.close("board")).toEqual({
      ok: false,
      reason: "not-allowed",
      message: "Board can't be closed here",
    });
    expect(jali.actions.toggleFullScreen("board")).toMatchObject({ reason: "not-allowed" });
    // Close others closes the rest and leaves the board.
    jali.actions.closeOthers("a");
    expect(
      jali
        .model()
        .panes.map((p) => p.id)
        .sort(),
    ).toEqual(["a", "board"]);
  });

  it("the workspace's `when` decides by context, and a kind can't be overridden back on", () => {
    const jali = make({ when: ({ action, pane }) => !(action === "move" && pane.id === "a") });
    expect(jali.actions.moveTab("a", 1)).toMatchObject({ reason: "not-allowed" });
    expect(jali.actions.moveTab("b", 0)).toMatchObject({ ok: true });
    expect(allows(storeOf(make({ close: true })).snapshot(), "board", "close")).toBe(false);
  });

  it("maximise can be turned off, but a maximised pane can always be restored", () => {
    const jali = make({ when: ({ action }) => action !== "maximise" });
    expect(jali.actions.toggleZoom("a")).toMatchObject({ reason: "not-allowed" });
    storeOf(jali).set({ view: { ...storeOf(jali).get().view, zoomed: "a" } });
    expect(jali.actions.toggleZoom("a")).toMatchObject({ ok: true });
  });

  it("⌘K greys out what the focused pane doesn't allow, and the tab menu leaves it out", () => {
    const jali = make({ pin: false });
    jali.actions.focus("board");
    const store = storeOf(jali);
    const close = commandDefsOf(store).find((c) => c.id === "pane.close")!;
    expect(close.check?.(store.snapshot())).toMatchObject({ reason: "not-allowed" });
    const items = tabMenuOf(store, "a")
      .flat()
      .map((i) => i.id);
    expect(items).toContain("close");
    expect(items).not.toContain("pin");
  });

  it("a divider beside a pane that can't be resized can't move", () => {
    const jali = make({
      when: ({ action, pane }) => !(action === "resize" && pane.id === "board"),
    });
    const x = storeOf(jali).snapshot();
    const root = jali.getLayout().root.id;
    expect(dividerAllowed(x, root, 0)).toBe(false);
    expect(STEPS.resizeDivider[0](x, root, 0, 40)).toMatchObject({ reason: "not-allowed" });
    expect(dividerAllowed(storeOf(make()).snapshot(), root, 0)).toBe(true);
  });
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

describe("allow, drawn", () => {
  it("draws no button, ×, grip or divider for what isn't allowed", () => {
    const jali = make({
      when: ({ action, pane }) => !(action === "resize" && pane.id === "board"),
    });
    const { container } = render(<JaliRoot jali={jali} />);
    const boardPane = container.querySelector('section[data-pane="board"]')!;
    expect(boardPane.querySelector(".jali-act-close")).toBeNull();
    expect(boardPane.querySelector(".jali-act-fullscreen")).toBeNull();
    expect(boardPane.querySelector(".jali-act-zoom")).not.toBeNull();
    expect(container.querySelector("[data-divider]")).toBeNull();
    const notes = render(
      <JaliRoot jali={make({ when: ({ action }) => action !== "close" && action !== "move" })} />,
    );
    expect(notes.container.querySelector(".jali-tab-close")).toBeNull();
    expect(notes.container.querySelector(".jali-grip")).toBeNull();
  });

  it("draws no Open beside in the peek, nor a tab strip's +, where `open` is off", () => {
    const launcher = definePane("new", { title: () => "New pane", Component: () => null });
    const withLauncher = (allow?: Allow) =>
      createJali({
        panes: [note, board],
        launcher,
        layout: row(
          pane(board(), { id: "board" }),
          tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
        ),
        storage: memoryStorage(),
        size: { width: 1200, height: 800 },
        moveFocus: false,
        ...(allow ? { allow } : {}),
      });
    const openBeside = (root: HTMLElement) =>
      root.querySelector('[data-testid="peek"] button[title="Open beside"]');
    const on = withLauncher();
    const shown = render(<JaliRoot jali={on} />);
    act(() => void on.actions.peek("a", note({ id: 3 })));
    expect(shown.container.querySelector(".jali-tab-add")).not.toBeNull();
    expect(openBeside(shown.container)).not.toBeNull();
    cleanup();
    const off = withLauncher({ open: false });
    const hidden = render(<JaliRoot jali={off} />);
    act(() => void off.actions.peek("a", note({ id: 3 })));
    expect(hidden.container.querySelector('[data-testid="peek"]')).not.toBeNull();
    expect(hidden.container.querySelector(".jali-tab-add")).toBeNull();
    expect(openBeside(hidden.container)).toBeNull();
    const items = tabMenuOf(storeOf(off), "a")
      .flat()
      .map((i) => i.id);
    expect(items).not.toContain("split-right");
  });
});
