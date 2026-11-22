/**
 * The core finds an adapter's elements through the adapter's `DomPort` (QUALITY-REVIEW P15): it never names
 * @jali/react's classes. These check the core's source for them, that the core asks the port it is given (and does
 * nothing harmful without one), and that @jali/react gives its own.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import {
  createJali,
  listCommands,
  memoryLocation,
  memoryStorage,
  row,
  type JaliOptions,
} from "@jali/core";
import {
  activeTabId,
  flashTab,
  focusShelfChip,
  isDividerDragging,
  noDom,
  shownShelf,
  storeOf,
  tabDropAt,
  type DomPort,
} from "@jali/core/adapter";
import { JaliRoot, definePane } from "@jali/react";
import { reactDom } from "../src/dom";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>Note {params.id}</p>,
});
const make = (options: Partial<JaliOptions> = {}) =>
  createJali({
    ...options,
    panes: [note],
    layout: row(note({ id: 1 }), note({ id: 2 })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
  });

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "test" ? [] : files(p);
    return f.endsWith(".ts") && !f.endsWith(".test.ts") ? [p] : [];
  });

describe("the core's source", () => {
  const root = join(import.meta.dirname, "../../core/src");
  // What the core may still name: what the host writes on its own elements (documented in the guides), and the parts
  // contract's reserved names (actions/content.ts), which it never queries.
  const HOST = new Set([
    "data-jali-chrome",
    "data-pane-region",
    "data-pane-keys",
    "data-no-drag",
    "data-drag-ok",
    "data-autofocus",
  ]);

  it("names no class of @jali/react's, and queries no attribute but the host's", () => {
    const found: string[] = [];
    for (const file of files(root)) {
      const name = relative(root, file);
      if (name === "state/messages.ts" || name === "state/page-messages.ts") continue;
      const code = readFileSync(file, "utf8")
        // comments say what the adapter renders; only code counts
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const m of code.matchAll(/["'`.\s(]\.?(jali-[a-z-]+)/g))
        if (
          !m[1]!.startsWith("jali-gap") &&
          !m[1]!.startsWith("jali-inset") &&
          !m[1]!.startsWith("jali-switcher-h")
        )
          found.push(`${name}: ${m[1]}`);
      for (const m of code.matchAll(/(?:closest|querySelector(?:All)?)\([^)]*?\[(data-[a-z-]+)/g))
        if (!HOST.has(m[1]!)) found.push(`${name}: [${m[1]}]`);
      for (const m of code.matchAll(/classList\.(add|remove|toggle|contains)/g))
        found.push(`${name}: classList.${m[1]}`);
    }
    expect(found).toEqual([]);
  });
});

describe("a workspace's DomPort", () => {
  it("is noDom until an adapter gives one, and every lookup then finds nothing", () => {
    const store = storeOf(make());
    expect(store.dom.port).toBe(noDom);
    expect(shownShelf(store.dom)).toBeNull();
    expect(focusShelfChip(store.dom)).toBe(false);
    expect(activeTabId(store.dom)).toBeUndefined();
    expect(tabDropAt(store, store.model().panes[0]!.id, 0, 0)).toBeUndefined();
  });

  it("is asked for what the core needs, and told what it does", () => {
    const store = storeOf(make());
    const chip = document.createElement("button");
    const shelf = document.createElement("div");
    shelf.append(chip);
    const tab = document.createElement("div");
    const port: DomPort = {
      ...noDom,
      shelf: vi.fn(() => shelf),
      shelfChip: vi.fn(() => chip),
      tab: vi.fn(() => tab),
      tabOf: vi.fn(() => "note-2"),
      flash: vi.fn(),
      dragging: vi.fn(),
    };
    store.dom.use(port);
    expect(store.dom.port).toBe(port);

    expect(focusShelfChip(store.dom)).toBe(true);
    expect(port.shelfChip).toHaveBeenCalledWith(shelf);
    expect(activeTabId(store.dom)).toBe("note-2");

    vi.useFakeTimers();
    flashTab(store.dom, "note-1");
    vi.runAllTimers();
    vi.useRealTimers();
    expect(port.tab).toHaveBeenCalledWith(store.dom.root(), "note-1");
    expect(port.flash).toHaveBeenCalledWith(tab);

    store.dom.setDragging("row");
    expect(isDividerDragging(store.dom)).toBe(true);
    expect(port.dragging).toHaveBeenLastCalledWith("row", undefined);
    store.dom.setDragging("pane");
    expect(isDividerDragging(store.dom)).toBe(false);
    store.dom.setDragging(null);
    expect(store.dom.dragging()).toBeNull();
    expect(port.dragging).toHaveBeenLastCalledWith(null, undefined);
  });

  it("is @jali/react's own once the workspace renders, and finds React's elements", () => {
    const jali = make();
    const { container } = render(<JaliRoot jali={jali} />);
    const store = storeOf(jali);
    expect(store.dom.port).toBe(reactDom);
    const frame = store.dom.pane(jali.model().panes[0]!.id)!;
    expect(reactDom.panes(container, frame)?.classList.contains("jali-workspace")).toBe(true);
    expect(reactDom.inPane(frame.firstElementChild ?? frame)).toBe(true);
    const release = reactDom.hold(frame);
    expect(release).toBeTypeOf("function");
    expect(frame.querySelector("[data-holding]")).not.toBeNull();
    release!();
    expect(frame.querySelector("[data-holding]")).toBeNull();
    reactDom.dragging("column");
    expect(document.body.classList.contains("jali-resizing-column")).toBe(true);
    reactDom.dragging(null);
    expect(document.body.className).not.toMatch(/jali-/);
  });

  it("carries @jali/react's pop out: given to each workspace it renders, never set for all as @jali/react loads", () => {
    const options = { allow: { popOut: true } } as const;
    const pop = (jali: ReturnType<typeof make>) =>
      listCommands(jali).find((c) => c.id === "pane.pop_out");
    // A browser that can pop out: Document Picture-in-Picture, on a secure page.
    vi.stubGlobal("documentPictureInPicture", { requestWindow: async () => window, window: null });
    const secure = Object.getOwnPropertyDescriptor(window, "isSecureContext");
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    try {
      // @jali/react is loaded (this file imports it), but a workspace it hasn't rendered has no way to pop out.
      const headless = make(options);
      headless.actions.focus(headless.model().panes[0]!.id);
      expect(pop(headless)).toMatchObject({ disabled: true });

      const jali = make(options);
      render(<JaliRoot jali={jali} />);
      expect(storeOf(jali).dom.port.popOut).toBe(reactDom.popOut);
      jali.actions.focus(jali.model().panes[0]!.id);
      expect(pop(jali)).toMatchObject({ disabled: false });
    } finally {
      vi.unstubAllGlobals();
      if (secure) Object.defineProperty(window, "isSecureContext", secure);
      else Reflect.deleteProperty(window, "isSecureContext");
    }
  });
});
