/**
 * Small accessibility polish (react-opus REACT-22): a tuck button that can't tuck stays reachable with its reason, and
 * a menu moves to an item by its first letter.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";
import { storeOf } from "@jali/core/adapter";

const size = { clientWidth: 1200, clientHeight: 800 };
beforeAll(() => {
  for (const [k, v] of Object.entries(size))
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get: () => v });
});
afterAll(() => {
  for (const k of Object.keys(size))
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
});
afterEach(cleanup);

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: () => null,
});
const make = () =>
  createJali({
    panes: [note],
    layout: row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    moveFocus: false,
  });

describe("small accessibility polish", () => {
  it("a tuck that can't happen is aria-disabled, focusable, and does nothing", () => {
    const jali = createJali({
      panes: [note],
      layout: row(...[1, 2, 3].map((id) => pane(note({ id }), { id: `n${id}` }))),
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      moveFocus: false,
    });
    render(<JaliRoot jali={jali} />);
    // A pane that holds a tucked tab can't tuck itself.
    act(() => void jali.actions.tuck("n1"));
    const off = document.querySelector<HTMLButtonElement>('.jali-act-tuck[aria-disabled="true"]')!;
    expect(off).not.toBeNull();
    expect(off.disabled).toBe(false);
    const before = jali.get().layout;
    act(() => void fireEvent.click(off));
    expect(jali.get().layout).toBe(before);
  });

  it("a menu moves to the item that starts with the letter typed", () => {
    render(<JaliRoot jali={make()} />);
    const more = document.querySelector<HTMLElement>('[data-pane="b"] .jali-act-menu')!;
    act(() => more.focus());
    act(() => void fireEvent.click(more));
    const items = [...document.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    const target = items.find((el, n) => n > 0 && /^[a-z]/i.test(el.textContent!.trim()))!;
    const letter = target.textContent!.trim()[0]!;
    const expected = items.find((el) =>
      el.textContent!.trim().toLowerCase().startsWith(letter.toLowerCase()),
    )!;
    act(() => void fireEvent.keyDown(document.activeElement!, { key: letter }));
    expect([expected, target]).toContain(document.activeElement);
    expect(document.activeElement).not.toBe(items[0] === expected ? null : items[0]);
  });
});

describe("a curated page's tabs", () => {
  it("listen for ⌥ on the window once, not again on every render (react-opus REACT-23)", async () => {
    const { definePage } = await import("@jali/react");
    const { vi } = await import("vite-plus/test");
    const Icon = () => null;
    const page = definePage({
      id: "visit",
      name: "Visit",
      itemNoun: "visit",
      home: "summary",
      roles: [{ id: "summary", label: "Summary", priority: "primary", icon: Icon }],
      firstItem: 1,
      bind: (item: number) => ({ summary: note({ id: item }) }),
      build: (item: number) => pane(note({ id: item }), { id: "summary", role: "summary" }),
      Header: () => null,
    });
    const jali = createJali({
      panes: [note],
      page,
      url: { location: memoryLocation() },
      storage: memoryStorage(),
      moveFocus: false,
    });
    jali.page!.open();
    const add = vi.spyOn(window, "addEventListener");
    const { JaliView } = await import("@jali/react");
    render(
      <JaliRoot jali={jali}>
        <JaliView />
      </JaliRoot>,
    );
    const keydowns = () => add.mock.calls.filter(([t]) => t === "keyup").length;
    const first = keydowns();
    for (const width of [900, 1000, 1100])
      act(() => void storeOf(jali).set({ area: { width, height: 700 } }));
    expect(keydowns()).toBe(first);
    add.mockRestore();
  });
});
