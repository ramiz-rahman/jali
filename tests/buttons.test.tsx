/**
 * The header's buttons (`buttons`): Jali's choice when the app gives none, a list or a function from the workspace and
 * then the kind, filtered by `allow`, with the way out of a state always shown; ⋯ for the rest of the pane's menu.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  createJali,
  memoryLocation,
  memoryStorage,
  pane,
  row,
  type PaneButtons,
  type WorkspaceAllow,
} from "@jali/core";
import { ALONE_CHROME, CHROME, buttonsOf, storeOf } from "@jali/core/adapter";
import { JaliRoot, definePane } from "@jali/react";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});
const chart = definePane("chart", {
  title: () => "Chart",
  buttons: (d) => [...d, "popOut"],
  Component: () => null,
});

const make = (opts: { buttons?: PaneButtons; allow?: WorkspaceAllow } = {}) =>
  createJali({
    panes: [note, chart],
    layout: row(pane(note({ id: 1 }), { id: "a" }), pane(chart(), { id: "c" })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    ...opts,
  });

const tiled = { chrome: CHROME.tiled, zoomed: false, full: false, tabs: false };

describe("buttons", () => {
  it("Jali chooses when the app doesn't: Tuck, Maximise, Close; Full screen in Maximise's place on a lone pane", () => {
    const x = storeOf(make()).snapshot();
    expect(buttonsOf(x, "a", tiled)).toEqual(["tuck", "maximise", "close"]);
    expect(buttonsOf(x, "a", { ...tiled, chrome: ALONE_CHROME })).toEqual(["fullScreen", "close"]);
    expect(buttonsOf(x, "a", { ...tiled, chrome: CHROME.single })).toEqual(["close"]);
  });

  it("Pop out is one of Jali's, before Close, where allow.popOut turns it on", () => {
    const x = storeOf(make({ allow: { popOut: true } })).snapshot();
    expect(buttonsOf(x, "a", tiled)).toEqual(["tuck", "maximise", "popOut", "close"]);
  });

  it("a workspace list replaces them, a kind's function adjusts the workspace's, and allow filters", () => {
    const x = storeOf(make({ buttons: ["maximise", "close"], allow: { popOut: true } })).snapshot();
    expect(buttonsOf(x, "a", tiled)).toEqual(["maximise", "close"]);
    expect(buttonsOf(x, "c", tiled)).toEqual(["maximise", "close", "popOut"]);
    // Pop out is off until the app turns it on: the kind's button isn't drawn.
    expect(buttonsOf(storeOf(make()).snapshot(), "c", tiled)).toEqual([
      "tuck",
      "maximise",
      "close",
    ]);
  });

  it("the way out always shows: Restore while maximised, Exit full screen while full screen", () => {
    const x = storeOf(make({ buttons: ["close"] })).snapshot();
    expect(buttonsOf(x, "a", { ...tiled, zoomed: true })).toEqual(["maximise", "close"]);
    expect(buttonsOf(x, "a", { ...tiled, full: true })).toEqual(["fullScreen", "close"]);
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

describe("buttons, drawn", () => {
  it("draws the buttons in order, then ⋯ before Close, which opens the pane's menu", () => {
    const { container } = render(<JaliRoot jali={make()} />);
    const a = container.querySelector('section[data-pane="a"] .jali-pane-actions')!;
    expect([...a.children].map((b) => (b as HTMLElement).dataset.action)).toEqual([
      "tuck",
      "zoom",
      "menu",
      "close",
    ]);
    fireEvent.click(screen.getByRole("button", { name: "More for Note 1" }));
    expect(screen.getByRole("menuitem", { name: /Full screen/ })).toBeTruthy();
  });
});
