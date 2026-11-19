/**
 * The styling contract (packages/react/src/parts.ts): every public part and attribute is something Jali really
 * renders. The parts a plain workspace shows are rendered and found (jsdom has no layout, so the workspace is told
 * its size); the rest (drag, peek, page, dialogs) are checked against the source, so a rename that forgets the contract fails here.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row, tabs } from "@jali/core";
import { JaliRoot, JaliView, Shelf, definePane } from "@jali/react";
import { parts, type PartName } from "../../packages/react/src/parts";

const src = join(__dirname, "../../packages/react/src");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory()
      ? files(p)
      : /\.tsx?$/.test(f) && !/test|parts\.ts/.test(f)
        ? [p]
        : [];
  });
const code = files(src)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

/** The class or attribute a selector names. */
const token = (selector: string) =>
  selector
    .match(/^\.([\w-]+)$|^\[([\w-]+)\]$/)!
    .slice(1)
    .find(Boolean)!;

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>Note {params.id}</p>,
});

const size = { clientWidth: 1600, clientHeight: 800 };

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

describe("styling contract", () => {
  it("every selector is a single class or attribute, and Jali's source sets it", () => {
    for (const [name, part] of Object.entries(parts)) {
      expect(token(part.selector), name).toBeTruthy();
      if (name !== "hostChrome") expect(code, part.selector).toContain(token(part.selector));
    }
  });

  it("every attribute is set by Jali's source", () => {
    for (const part of Object.values(parts))
      for (const a of part.attributes) expect(code, `${part.selector} ${a.name}`).toContain(a.name);
  });

  it("a workspace with a pane, a tab group with a pinned tab, then a tucked pane, renders its parts", () => {
    const jali = createJali({
      panes: [note],
      layout: row(note({ id: 1 }), tabs(pane(note({ id: 2 }), { pinned: true }), note({ id: 3 }))),
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      size: { width: 1600, height: 800 },
      moveFocus: false,
    });
    const { container } = render(
      <JaliRoot jali={jali}>
        <JaliView />
        <Shelf />
      </JaliRoot>,
    );
    const rendered: PartName[] = [
      "root",
      "layer",
      "workspace",
      "pane",
      "paneHeader",
      "paneTitle",
      "paneActions",
      "paneContent",
      "tabBar",
      "pinnedTabs",
      "tabItem",
      "tab",
      "tabClose",
      "tabIndicator",
      "icon",
      "divider",
    ];
    const find = (n: PartName) => document.querySelector(parts[n].selector);
    for (const n of rendered) expect(find(n), n).not.toBeNull();
    expect(container.querySelector(".jali-pane[data-pane][data-kind]")).not.toBeNull();
    expect(container.querySelector(".jali-tab[data-pinned][aria-selected]")).not.toBeNull();

    // A tab's menu opens in the layer beside the root, with the dialogs, so tokens set around <JaliRoot> reach it.
    act(() => void fireEvent.contextMenu(container.querySelector(".jali-tab")!));
    expect(document.querySelector("[data-jali-layer] .jali-tab-menu")).not.toBeNull();
    act(() => void fireEvent.keyDown(document.querySelector(".jali-tab-menu")!, { key: "Escape" }));

    const other = container.querySelector<HTMLElement>(".jali-pane:not(:has(.jali-tabbar))")!
      .dataset.pane!;
    act(() => void jali.actions.tuck(other));
    expect(find("shelf")).not.toBeNull();
    expect(
      container.querySelector('.jali-shelf-chip[data-chip][data-reason="tucked"][data-activity]'),
    ).not.toBeNull();
  });
});
