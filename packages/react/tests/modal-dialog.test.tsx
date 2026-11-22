/**
 * The workspace's dialogs are modal (APG dialog): focus goes in when one opens and back where it was when it closes,
 * Tab and ⇧Tab wrap inside it, the workspace behind is inert, Esc closes it, and the keymap leaves the keys to it.
 * The same for Settings, the discard question, ⌘K and the chooser (QUALITY-REVIEW P6).
 */
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row, tabs } from "@jali/core";
import type { LayoutInput } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, definePane, useUnsaved } from "@jali/react";
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
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 600 },
    moveFocus: false,
  });

const tab = (name: string) => screen.getByRole("tab", { name });
const root = () => document.querySelector<HTMLElement>("[data-jali]")!;
const press = (key: string, init: object = {}) =>
  fireEvent.keyDown(document.activeElement!, { key, ...init });

/** Opens a dialog from a focused tab, and returns the tab. */
function fromTab(name: string, open: () => void) {
  const t = tab(name);
  act(() => t.focus());
  act(open);
  return t;
}

describe("Settings", () => {
  it("takes focus, wraps Tab inside, makes the workspace inert, and gives focus back on Esc", () => {
    const jali = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" }))),
    );
    render(<JaliRoot jali={jali} />);
    const t = fromTab("Note 1", () => storeOf(jali).set({ settingsOpen: true }));
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(root().inert).toBe(true);

    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "System" }));
    // ⇧Tab on the first stop (its close button) goes to the last, and Tab on the last back to the first. (jsdom makes
    // no Tab moves of its own: only the dialog's wrap moves focus here.)
    const first = screen.getByRole("button", { name: "Close settings" });
    act(() => first.focus());
    press("Tab", { shiftKey: true });
    const last = document.activeElement;
    expect(last).not.toBe(first);
    expect(dialog.contains(last)).toBe(true);
    press("Tab");
    expect(document.activeElement).toBe(first);

    act(() => void press("Escape"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(root().inert).toBe(false);
    expect(document.activeElement).toBe(t);
  });

  it("gives focus back after its close button too", () => {
    const jali = make(row(pane(note({ id: 1 }), { id: "a" })));
    render(<JaliRoot jali={jali} />);
    const before = document.querySelector<HTMLElement>('[data-pane="a"]')!;
    act(() => before.focus());
    act(() => storeOf(jali).set({ settingsOpen: true }));
    act(() => screen.getByRole("button", { name: "Close settings" }).click());
    expect(document.activeElement).toBe(before);
  });
});

describe("the discard question", () => {
  const ask = () => {
    const jali = make(
      row(
        tabs(pane(draft({ id: 1 }), { id: "d" }), pane(note({ id: 1 }), { id: "a" })),
        pane(note({ id: 2 }), { id: "b" }),
      ),
    );
    render(<JaliRoot jali={jali} />);
    act(() => void jali.actions.focus("d"));
    const t = fromTab("Draft 1", () => void press("Delete"));
    return {
      jali,
      t,
      dialog: screen.getByRole("alertdialog", { name: /Discard unsaved changes/ }),
    };
  };

  it("starts on Keep editing, keeps Tab inside, and gives focus back to the tab on Esc", () => {
    const { t, dialog } = ask();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep editing" }));
    expect(root().inert).toBe(true);
    press("Tab");
    expect(dialog.contains(document.activeElement)).toBe(true);
    press("Tab");
    expect(dialog.contains(document.activeElement)).toBe(true);
    act(() => void press("Escape"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(t);
    expect(root().inert).toBe(false);
  });

  it("holds the keymap while it is open: F6 moves no focus behind it", () => {
    const { jali } = ask();
    const store = storeOf(jali);
    expect(store.get().view.focused).toBe("d");
    act(() => void press("F6"));
    expect(store.get().view.focused).toBe("d");
    expect(store.get().confirm).not.toBeNull();
  });
});

describe("⌘K", () => {
  it("gives focus back where it was when it closes, and keeps Tab in itself", () => {
    const jali = make(
      row(tabs(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" }))),
    );
    render(<JaliRoot jali={jali} />);
    const t = fromTab("Note 1", () => storeOf(jali).set({ paletteOpen: true }));
    const input = screen.getByRole("combobox");
    expect(document.activeElement).toBe(input);
    expect(root().inert).toBe(true);
    // The field is its only stop: Tab stays on it.
    press("Tab");
    expect(document.activeElement).toBe(input);
    act(() => void press("Escape"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(t);
  });

  it("scrolls the selected option into the list's view", () => {
    const jali = make(row(pane(note({ id: 1 }), { id: "a" })));
    render(<JaliRoot jali={jali} />);
    act(() => storeOf(jali).set({ paletteOpen: true }));
    const list = screen.getByRole("listbox");
    let top = 0;
    Object.defineProperty(list, "scrollTop", {
      get: () => top,
      set: (v: number) => {
        top = v;
      },
    });
    // A list 100px high of 40px options, scrolled by `top`.
    list.getBoundingClientRect = () => ({ top: 0, bottom: 100 }) as DOMRect;
    screen.getAllByRole("option").forEach((o, n) => {
      o.getBoundingClientRect = () => ({ top: n * 40 - top, bottom: n * 40 + 40 - top }) as DOMRect;
    });
    for (let n = 0; n < 3; n++) act(() => void press("ArrowDown"));
    expect(top).toBe(60); // the fourth option's bottom (160) at the list's bottom
    for (let n = 0; n < 3; n++) act(() => void press("ArrowUp"));
    expect(top).toBe(0);
  });
});

describe("the chooser", () => {
  it("gives focus back to the pane it was opened from", () => {
    const jali = make(row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })));
    render(<JaliRoot jali={jali} />);
    const from = document.querySelector<HTMLElement>('[data-pane="a"]')!;
    act(() => from.focus());
    act(
      () =>
        void jali.dialogs.choose({
          title: "Pick",
          items: [1, 2],
          label: String,
          onChoose: () => {},
        }),
    );
    expect(screen.getByRole("dialog", { name: "Pick" }).contains(document.activeElement)).toBe(
      true,
    );
    act(() => void press("Escape"));
    expect(document.activeElement).toBe(from);
  });
});

describe("the host's overlays", () => {
  /** Inert itself or inside something inert: out of the tab order, the accessibility tree and the pointer. */
  const inert = (el: Element | null) => {
    for (let at = el; at; at = at.parentElement) if ((at as HTMLElement).inert) return true;
    return false;
  };
  const toaster = (
    <section aria-label="Notifications" aria-live="polite">
      <p>Note 2 closed</p>
      <button type="button">Undo</button>
    </section>
  );

  it("are inert while a dialog is open, and Jali's announcements are still heard", async () => {
    const jali = make(row(pane(note({ id: 1 }), { id: "a" }), pane(note({ id: 2 }), { id: "b" })));
    render(<JaliRoot jali={jali} overlays={toaster} />);
    const undo = screen.getByRole("button", { name: "Undo" });
    expect(inert(undo)).toBe(false);
    // In an element of their own that takes no box: the toaster lays out as if it were the provider's child.
    const wrap = document.querySelector<HTMLElement>("[data-jali-overlays]")!;
    expect(wrap.contains(undo)).toBe(true);
    expect(wrap.style.display).toBe("contents");

    act(() => storeOf(jali).set({ settingsOpen: true }));
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy();
    expect(inert(undo)).toBe(true);
    expect(inert(root())).toBe(true);
    // The live region is outside everything made inert, and still speaks.
    const announcer = screen.getByTestId("announcer");
    expect(inert(announcer)).toBe(false);
    act(() => storeOf(jali).announce("Theme: dark"));
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(announcer.textContent).toBe("Theme: dark");

    act(() => void press("Escape"));
    expect(inert(undo)).toBe(false);
  });

  it("are inert behind the discard question too, and an overlay the host made inert stays inert", () => {
    const jali = make(row(pane(note({ id: 1 }), { id: "a" }), pane(draft({ id: 2 }), { id: "b" })));
    render(
      <JaliRoot
        jali={jali}
        overlays={
          <>
            {toaster}
            <aside
              ref={(el) => {
                if (el) el.inert = true;
              }}
            >
              <button type="button">Host's own</button>
            </aside>
          </>
        }
      />,
    );
    const own = screen.getByRole("button", { name: "Host's own", hidden: true });
    act(() => void jali.actions.close("b"));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(inert(screen.getByRole("button", { name: "Undo", hidden: true }))).toBe(true);
    act(() => void press("Escape"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(inert(screen.getByRole("button", { name: "Undo" }))).toBe(false);
    expect(inert(own)).toBe(true);
  });

  it("add no element when there are none", () => {
    render(<JaliRoot jali={make(row(pane(note({ id: 1 }), { id: "a" })))} />);
    expect(document.querySelector("[data-jali-overlays]")).toBeNull();
  });
});
