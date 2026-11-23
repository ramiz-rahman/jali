/**
 * Stabilisation, React stream (docs/reviews/2026-11-23/PLAN.md): focus stays in an open dialog whatever the browser's
 * Tab does, a dialog's opener is what was pressed, header controls belong to whoever registered them, and every
 * boundary Jali renders resets with the instance (a dialog that throws closes itself).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { memo, useEffect, useState } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { lastPressedControl, trackInput, storeOf } from "@jali/core/adapter";
import { createJali, memoryLocation, memoryStorage, pane, row, type AnyJali } from "@jali/core";
import { JaliRoot, definePane, useCommands, useHeaderActions, useUnsaved } from "@jali/react";
import { defaultFeatures, urlSync } from "./features";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  for (const [prop, px] of [
    ["clientWidth", 1200],
    ["clientHeight", 600],
  ] as const)
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("jali-layout") ? px : 0;
      },
    });
});
beforeEach(() => void vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const note = definePane("note", { title: () => "Note", Component: () => <p>note body</p> });
const make = (id?: string): AnyJali =>
  createJali({
    id,
    panes: [note],
    layout: pane(note({}), { id: "a" }),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
  });

describe("focus never leaves an open dialog", () => {
  it("comes back in when Tab takes it out (a browser whose Tab skips buttons), at the end it left from", async () => {
    const jali = make();
    render(<JaliRoot jali={jali} />);
    act(() => void jali.dialogs.openSettings());
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    const inside = () => dialog.contains(document.activeElement);
    const radios = screen.getAllByRole("radio");
    act(() => radios.at(-1)!.focus());
    // The browser's own Tab moves on out of the dialog (nothing in jsdom does it: the test does).
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    act(() => (document.activeElement as HTMLElement).blur());
    await act(async () => void (await Promise.resolve()));
    expect(inside()).toBe(true);
    // ⇧Tab: back in at the last stop.
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    act(() => (document.activeElement as HTMLElement).blur());
    await act(async () => void (await Promise.resolve()));
    expect(inside()).toBe(true);
    // Without a Tab behind it, a blur (a click on nothing) is left alone.
    await act(async () => void (await new Promise((r) => setTimeout(r))));
    act(() => (document.activeElement as HTMLElement).blur());
    await act(async () => void (await Promise.resolve()));
    expect(inside()).toBe(false);
  });
});

describe("focus returns to what was pressed", () => {
  it("a dialog the host's button opens gives focus back to that button when focus was on the page (Safari)", () => {
    const jali = make();
    render(
      <>
        <button type="button" onClick={() => void jali.dialogs.openSettings()}>
          Host settings
        </button>
        <JaliRoot jali={jali} />
      </>,
    );
    const btn = screen.getByRole("button", { name: "Host settings" });
    // Safari: the press lands on the button, which takes no focus.
    fireEvent.pointerDown(btn);
    fireEvent.click(btn);
    expect(document.activeElement).not.toBe(btn);
    act(() => void fireEvent.keyDown(document.activeElement!, { key: "Escape" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(btn);
  });

  it("a key pressed since means the press is no longer what opened it", () => {
    const jali = make();
    render(
      <>
        <button type="button">Host</button>
        <JaliRoot jali={jali} />
      </>,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "Host" }));
    fireEvent.keyDown(document.body, { key: "k", metaKey: true });
    act(() => void jali.dialogs.openSettings());
    act(() => void fireEvent.keyDown(document.activeElement!, { key: "Escape" }));
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Host" }));
  });
});

describe("header controls belong to whoever registered them", () => {
  const Contributor = memo(function Contributor({ label }: { label: string }) {
    useHeaderActions(<button type="button">{label}</button>);
    return null;
  });
  let toggleA: (on: boolean) => void = () => {};
  const both = definePane("both", {
    title: () => "Both",
    Component: () => {
      const [a, setA] = useState(true);
      toggleA = setA;
      return (
        <>
          {a ? <Contributor label="A controls" /> : null}
          <Contributor label="B controls" />
        </>
      );
    },
  });
  const header = () => document.querySelector(".jali-pane-header")!;

  it("the latest mounted shows; unmounting one releases only its own, without the other re-rendering", () => {
    const jali = createJali({
      panes: [both],
      layout: pane(both({}), { id: "a" }),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1200, height: 600 },
      moveFocus: false,
    });
    render(<JaliRoot jali={jali} />);
    expect(header().textContent).toContain("B controls");
    expect(header().textContent).not.toContain("A controls");
    act(() => toggleA(false));
    expect(header().textContent).toContain("B controls");
    // A mounts after B: it is the latest, and B's show again once it goes.
    act(() => toggleA(true));
    expect(header().textContent).toContain("A controls");
    expect(header().textContent).not.toContain("B controls");
    act(() => toggleA(false));
    expect(header().textContent).toContain("B controls");
  });
});

describe("boundaries reset with the instance", () => {
  function Boom(): never {
    throw new Error("boom");
  }
  it("another instance renders without the old one's failure, and the host's healthy children stay mounted", () => {
    const a = make(),
      b = make();
    const onError = vi.fn();
    // Mounts counted in an effect: React retries a render that threw, so render-time counts would double.
    let mounts = 0;
    const Healthy = () => {
      useEffect(() => void ++mounts, []);
      return <p>healthy</p>;
    };
    const App = ({ jali, bad }: { jali: AnyJali; bad: boolean }) => (
      <>
        <Healthy />
        <JaliRoot jali={jali} onError={onError}>
          {bad ? <Boom /> : <p>b child</p>}
        </JaliRoot>
      </>
    );
    const { rerender } = render(<App jali={a} bad />);
    expect(screen.getByRole("alert").textContent).toMatch(/could not be shown/);
    rerender(<App jali={b} bad={false} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("b child")).toBeTruthy();
    expect(mounts).toBe(1);
  });

  it("a palette that throws closes itself, tells onError, and Settings then opens", () => {
    // A command whose title React cannot draw: the palette throws as it renders the list.
    const broken = definePane("broken", {
      title: () => "Broken",
      Component: () => {
        useCommands([{ id: "x", title: {} as unknown as string, run: () => {} }]);
        return <p>broken body</p>;
      },
    });
    const jali = createJali({
      panes: [broken],
      layout: pane(broken({}), { id: "a" }),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1200, height: 600 },
      moveFocus: false,
    });
    const onError = vi.fn();
    render(<JaliRoot jali={jali} onError={onError} />);
    act(() => void jali.dialogs.openPalette());
    expect(onError).toHaveBeenCalled();
    expect(storeOf(jali).get().paletteOpen).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => void jali.dialogs.openSettings());
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
  });
});

describe("review fixes", () => {
  it("two instances with a dialog open each: Tab never hangs, and the topmost keeps focus", async () => {
    const a = make("one"),
      b = make("two");
    render(
      <>
        <JaliRoot jali={a} />
        <JaliRoot jali={b} />
      </>,
    );
    act(() => void a.dialogs.openSettings());
    act(() => void b.dialogs.openSettings());
    const dialogs = screen.getAllByRole("dialog", { hidden: true });
    expect(dialogs).toHaveLength(2);
    for (let n = 0; n < 6; n++) {
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Tab",
        shiftKey: n % 2 === 1,
      });
      act(() => (document.activeElement as HTMLElement | null)?.blur());
      await act(async () => void (await Promise.resolve()));
      expect(dialogs[1]!.contains(document.activeElement)).toBe(true);
    }
  });

  it("Close from a pane's menu, then Keep editing: focus goes back to the pane, not the page", () => {
    const draft = definePane("draft", {
      title: () => "Draft",
      Component: () => {
        useUnsaved("a reply");
        return <p>draft body</p>;
      },
    });
    const jali = createJali({
      panes: [draft, note],
      layout: row(pane(draft({}), { id: "d" }), pane(note({}), { id: "n" })),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1200, height: 600 },
      moveFocus: false,
    });
    render(<JaliRoot jali={jali} />);
    const section = document.querySelector<HTMLElement>('[data-pane="d"]')!;
    fireEvent.contextMenu(section.querySelector(".jali-pane-header")!);
    const item = screen.getByRole("menuitem", { name: /^Close/ });
    fireEvent.pointerDown(item);
    fireEvent.click(item);
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(section);
  });

  it("the pressed element is forgotten when the last instance stops listening", () => {
    const btn = document.body.appendChild(document.createElement("button"));
    const stop = trackInput(document);
    const stop2 = trackInput(document);
    fireEvent.pointerDown(btn);
    expect(lastPressedControl(document)).toBe(btn);
    stop();
    expect(lastPressedControl(document)).toBe(btn);
    stop2();
    expect(lastPressedControl(document)).toBeNull();
    btn.remove();
  });
});
