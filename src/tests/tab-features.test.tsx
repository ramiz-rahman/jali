/**
 * Tab features for apps with documents (Data Studio's request, 19 Nov 2026): the unsaved mark on a tab and wherever
 * else the pane is named, middle-click to close, and `confirmDiscard: false` for an app that asks itself.
 */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row, tabs } from "@jali/core";
import type { JaliOptions, LayoutInput } from "@jali/core";
import { JaliRoot, definePane, useUnsaved } from "@jali/react";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  // jsdom lays nothing out: give the workspace the room its jali was made with, so nothing folds.
  for (const [prop, px] of [
    ["clientWidth", 1200],
    ["clientHeight", 600],
  ] as const)
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("jali-workspace") ? px : 0;
      },
    });
});
afterEach(cleanup);

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => <p>note body {params.id}</p>,
});
const draft = definePane("draft", {
  params: { id: Number },
  title: ({ id }) => `Draft ${id}`,
  Component: () => {
    useUnsaved("a reply");
    return <p>draft body</p>;
  },
});

const make = (layout: LayoutInput, options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [note, draft],
    layout,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
    ...options,
  });

const tab = (name: string) => screen.getByRole("tab", { name });

describe("the unsaved mark", () => {
  it("marks a tab with unsaved work, and says so in its description", () => {
    const jali = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(draft({ id: 2 }), { id: "b" }))),
    );
    render(<JaliRoot jali={jali} />);
    const t = tab("Draft 2");
    expect(t.hasAttribute("data-unsaved")).toBe(true);
    expect(t.parentElement!.hasAttribute("data-unsaved")).toBe(true);
    expect(t.getAttribute("aria-description")).toBe("Unsaved changes. Delete closes it.");
    // The dot sits in the close button, which still closes.
    const close = within(t.parentElement!).getByRole("button", {
      name: "Close Draft 2",
      hidden: true,
    });
    expect(close.querySelector(".jali-unsaved")).not.toBeNull();
    expect(tab("Note 1").hasAttribute("data-unsaved")).toBe(false);
    expect(tab("Note 1").getAttribute("aria-description")).toBe("Delete closes it.");
  });

  it("names it on a lone pane's header", () => {
    const jali = make(row(pane(draft({ id: 2 }), { id: "b" }), pane(note({ id: 1 }), { id: "a" })));
    render(<JaliRoot jali={jali} />);
    expect(screen.getAllByRole("img", { name: "Unsaved changes" })).toHaveLength(1);
  });
});

describe("middle-click", () => {
  it("closes a tab the way its close button does", () => {
    const asked: string[] = [];
    const jali = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" }))),
      { beforeClose: (r) => (asked.push(`${r.reason}:${r.panes.map((p) => p.pane)}`), true) },
    );
    render(<JaliRoot jali={jali} />);
    act(
      () =>
        void fireEvent(
          tab("Note 2").parentElement!,
          new MouseEvent("auxclick", { bubbles: true, button: 1 }),
        ),
    );
    expect(asked).toEqual(["close:b"]);
    expect(jali.model().panes.map((p) => p.id)).toEqual(["a"]);
  });

  it("ignores other buttons", () => {
    const jali = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" }))),
    );
    render(<JaliRoot jali={jali} />);
    act(
      () =>
        void fireEvent(
          tab("Note 2").parentElement!,
          new MouseEvent("auxclick", { bubbles: true, button: 2 }),
        ),
    );
    expect(jali.model().panes).toHaveLength(2);
  });
});

describe("confirmDiscard: false", () => {
  const layout = row(pane(draft({ id: 2 }), { id: "b" }), pane(note({ id: 1 }), { id: "a" }));

  it("closes a pane with unsaved work once the app's beforeClose says yes, without Jali asking again", () => {
    const jali = make(layout, { confirmDiscard: false, beforeClose: () => true });
    render(<JaliRoot jali={jali} />);
    let r: ReturnType<typeof jali.actions.close> | undefined;
    act(() => void (r = jali.actions.close("b")));
    expect(r!.ok).toBe(true);
    expect(jali.model().panes.map((p) => p.id)).toEqual(["a"]);
    expect(screen.queryByText("Discard unsaved changes?")).toBeNull();
  });

  it("still shows the mark", () => {
    const jali = make(layout, { confirmDiscard: false });
    render(<JaliRoot jali={jali} />);
    expect(screen.getAllByRole("img", { name: "Unsaved changes" })).toHaveLength(1);
  });

  it("by default, Jali asks", () => {
    const jali = make(layout);
    render(<JaliRoot jali={jali} />);
    let r: ReturnType<typeof jali.actions.close> | undefined;
    act(() => void (r = jali.actions.close("b")));
    expect(r!.reason).toBe("unsaved");
    expect(jali.model().panes).toHaveLength(2);
  });
});
