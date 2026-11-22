/**
 * A tab strip follows the APG tabs pattern with deletable tabs: a tab holds no controls, its close and put back are
 * its siblings out of the tab order, and Delete or Backspace on a focused tab closes it through the normal close.
 */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row, runCommand, tabs } from "@jali/core";
import type { LayoutInput } from "@jali/core";
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

const make = (layout: LayoutInput) =>
  createJali({
    panes: [note, draft],
    layout,
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
  });

const tab = (name: string) => screen.getByRole("tab", { name });

describe("a tab strip", () => {
  it("keeps every control out of its tabs: siblings for the pointer, out of the tab order and the accessibility tree", () => {
    const jali = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" }))),
    );
    render(<JaliRoot jali={jali} />);
    for (const t of screen.getAllByRole("tab")) {
      expect(t.querySelector("button, [tabindex]")).toBeNull();
      expect(t.parentElement!.getAttribute("role")).toBe("presentation");
      expect(t.getAttribute("aria-keyshortcuts")).toBe("Delete Backspace Shift+F10");
      expect(t.getAttribute("aria-description")).toBe("Delete closes it.");
    }
    const item = within(tab("Note 2").parentElement!);
    expect(item.queryByRole("button", { name: "Close Note 2" })).toBeNull();
    const close = item.getByRole("button", { name: "Close Note 2", hidden: true });
    expect(close.getAttribute("tabindex")).toBe("-1");
    expect(close.parentElement!.parentElement).toBe(tab("Note 2").parentElement);
  });

  it("closes a focused tab on Delete or Backspace, and a click on its close button still closes it", () => {
    const jali = make(
      row(
        tabs(
          pane(note({ id: 1 }), { id: "a" }),
          pane(note({ id: 2 }), { id: "b" }),
          pane(note({ id: 3 }), { id: "c" }),
        ),
      ),
    );
    render(<JaliRoot jali={jali} />);
    fireEvent.keyDown(tab("Note 2"), { key: "Delete" });
    expect(screen.queryByRole("tab", { name: "Note 2" })).toBeNull();
    fireEvent.keyDown(tab("Note 3"), { key: "Backspace" });
    expect(screen.queryByRole("tab", { name: "Note 3" })).toBeNull();
    // A modified Backspace is someone else's key.
    act(() => void jali.actions.addTab("a", note({ id: 4 })));
    fireEvent.keyDown(tab("Note 4"), { key: "Backspace", metaKey: true });
    expect(tab("Note 4")).toBeTruthy();
    fireEvent.click(
      within(tab("Note 4").parentElement!).getByRole("button", {
        name: "Close Note 4",
        hidden: true,
      }),
    );
    expect(screen.queryByRole("tab", { name: "Note 4" })).toBeNull();
  });

  it("asks before Delete closes a tab with unsaved work", () => {
    const jali = make(
      row(tabs(pane(draft({ id: 1 }), { id: "d" }), pane(note({ id: 1 }), { id: "a" }))),
    );
    render(<JaliRoot jali={jali} />);
    act(() => void jali.actions.focus("d"));
    fireEvent.keyDown(tab("Draft 1"), { key: "Delete" });
    expect(screen.getByRole("alertdialog", { name: /Discard unsaved changes/ })).toBeTruthy();
    expect(tab("Draft 1")).toBeTruthy();
  });

  it("describes a tucked tab with its put back key, and puts back the focused tucked tab", () => {
    const jali = make(row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })));
    render(<JaliRoot jali={jali} />);
    act(() => void jali.actions.tuck("b"));
    const tucked = tab("Note 2");
    expect(tucked.getAttribute("data-tucked")).toBe("true");
    expect(tucked.getAttribute("aria-description")).toMatch(
      /^Tucked here\. (⌘K ⌘\]|Ctrl\+K Ctrl\+\]) puts it back\. Delete closes it\.$/,
    );
    const putBack = screen.getByRole("button", { name: "Put back Note 2", hidden: true });
    expect(putBack.getAttribute("tabindex")).toBe("-1");
    expect(tucked.contains(putBack)).toBe(false);
    // Another pane tucked later would be the one put back, but the focused tucked tab wins.
    act(() => void jali.actions.split("a"));
    act(() => tucked.focus());
    act(() => void runCommand(jali, "pane.putBack"));
    expect(screen.queryByRole("tab", { name: "Note 2" })).toBeNull();
    expect(jali.model().pane("b")).toBeTruthy();
  });
});
