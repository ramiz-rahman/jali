// @vitest-environment jsdom
/**
 * The pane's actions are built once (pane/actions.ts): its header's buttons and its menu are two views of them, so a
 * narrow header that moves Pop out into ⋯ moves the same action. Popped out, the button says Bring back and so does
 * the menu, and choosing it closes the window. A fake Document Picture-in-Picture (as pop-out.test.tsx's) gives the
 * window; jsdom lays nothing out, so the test says how wide the header is (as header-narrow.test.tsx does).
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createJali, memoryLocation, memoryStorage, pane, row, type Allow } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";
import { defaultFeatures, popOut, urlSync } from "./features";

const note = definePane("note", {
  params: { n: Number },
  title: ({ n }) => `Note ${n}`,
  Component: () => <p>note</p>,
});
const make = (allow?: Allow) =>
  createJali({
    panes: [note],
    ...(allow ? { allow } : {}),
    layout: row(pane(note({ n: 1 }), { id: "a" }), pane(note({ n: 2 }), { id: "b" })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() }), popOut()],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    phone: { below: 0 },
  });

/** A floating window, as the browser's: an iframe's window, closed by taking the iframe out and saying `pagehide`. */
let windows: Window[] = [];
const closed = new WeakSet<Window>();
function floating(): Window {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const win = frame.contentWindow!;
  win.close = () => {
    if (closed.has(win)) return;
    closed.add(win);
    win.dispatchEvent(new Event("pagehide"));
    frame.remove();
  };
  windows.push(win);
  return win;
}
const open = () =>
  windows.filter((w) => !closed.has(w) && w.document.querySelector("[data-jali-popout]"));

/** The header's width, and the shown title's: the room it has and the width its whole text wants. */
let room = { header: 600, title: 200, wants: 120 };
const observers = new Set<() => void>();
const resize = () => act(() => observers.forEach((fn) => fn()));
const props = ["clientWidth", "clientHeight", "scrollWidth"] as const;

beforeAll(() => {
  globalThis.ResizeObserver = class {
    fn: () => void;
    constructor(fn: () => void) {
      this.fn = () => fn();
    }
    observe() {
      observers.add(this.fn);
    }
    unobserve() {}
    disconnect() {
      observers.delete(this.fn);
    }
  } as unknown as typeof ResizeObserver;
  const size = (el: HTMLElement, prop: "clientWidth" | "clientHeight" | "scrollWidth") => {
    if (el.classList.contains("jali-layout")) return prop === "clientHeight" ? 800 : 1200;
    if (prop === "clientHeight") return 0;
    if (el.classList.contains("jali-pane-header")) return prop === "clientWidth" ? room.header : 0;
    if (el.tagName === "H2" && el.closest(".jali-pane-title"))
      return prop === "scrollWidth" ? room.wants : room.title;
    return 0;
  };
  for (const prop of props) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return size(this, prop);
      },
    });
  }
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  window.matchMedia ??= (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
beforeEach(() => {
  vi.stubGlobal("documentPictureInPicture", {
    window: null,
    requestWindow: async () => floating(),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const w of windows) w.close();
  windows = [];
  observers.clear();
  room = { header: 600, title: 200, wants: 120 };
});
afterAll(() => {
  for (const prop of props)
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
  Reflect.deleteProperty(window, "isSecureContext");
});

const headerOf = (id: string) =>
  document.querySelector<HTMLElement>(`[data-pane="${id}"] .jali-pane-header`)!;
const actionsOf = (id: string) =>
  [...headerOf(id).querySelectorAll<HTMLElement>(".jali-pane-actions .jali-pane-action")].map(
    (b) => b.dataset.action,
  );
const popButton = (id: string) =>
  headerOf(id).querySelector<HTMLButtonElement>('[data-action="popout"]');
/** Opens pane `id`'s menu from its ⋯, and returns its items' names. */
const menuOf = (id: string) => {
  fireEvent.click(within(headerOf(id)).getByRole("button", { name: /^More/ }));
  return [...screen.getByRole("menu").querySelectorAll("[data-menu-item]")].map(
    (i) => i.textContent,
  );
};
const closeMenu = () => fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
const popOutA = async () => {
  await act(async () => {
    fireEvent.click(popButton("a")!);
    await Promise.resolve();
  });
  expect(open()).toHaveLength(1);
};

describe("the pane's header and menu, from one set of actions", () => {
  it("say the same at normal widths: Pop out, then Bring back once it's out", async () => {
    render(<JaliRoot jali={make()} />);
    expect(actionsOf("a")).toContain("popout");
    expect(popButton("a")!.getAttribute("aria-label")).toBe("Pop out Note 1");
    expect(menuOf("a")).toContain("Pop out");
    closeMenu();
    await popOutA();
    expect(popButton("a")!.getAttribute("aria-label")).toBe("Bring back Note 1");
    const items = menuOf("a");
    expect(items).toContain("Bring back");
    expect(items).not.toContain("Pop out");
  });

  it("a narrow header moves Pop out into ⋯ as it is: popped out, the menu says Bring back, and it closes the window", async () => {
    render(<JaliRoot jali={make()} />);
    await popOutA();
    room = { header: 200, title: 20, wants: 120 };
    resize();
    expect(headerOf("a").dataset.narrow).toBe("actions");
    expect(actionsOf("a")).toEqual(["menu", "close"]);
    const items = menuOf("a");
    expect(items).toContain("Bring back");
    expect(items).not.toContain("Pop out");
    const back = within(screen.getByRole("menu")).getByRole("menuitem", { name: "Bring back" });
    act(() => back.focus());
    fireEvent.keyDown(back, { key: "Enter" });
    expect(open()).toHaveLength(0);
    expect(windows).toHaveLength(1);
  });

  it("a narrow header's Pop out in ⋯ pops the pane out", async () => {
    render(<JaliRoot jali={make()} />);
    room = { header: 200, title: 20, wants: 120 };
    resize();
    expect(actionsOf("a")).toEqual(["menu", "close"]);
    menuOf("a");
    await act(async () => {
      fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Pop out" }));
      await Promise.resolve();
    });
    expect(open()).toHaveLength(1);
  });

  it("keeps Bring back in the header once out, even when the app stops allowing Pop out", async () => {
    let popOutOn = true;
    const jali = make({ when: ({ action }) => action !== "popOut" || popOutOn });
    render(<JaliRoot jali={jali} />);
    await popOutA();
    popOutOn = false;
    // Something else changes, so the header works itself out again with the new rule.
    await act(async () => void (await jali.actions.focus("b")));
    expect(popButton("a")!.getAttribute("aria-label")).toBe("Bring back Note 1");
    expect(popButton("b")).toBeNull();
    fireEvent.click(popButton("a")!);
    expect(open()).toHaveLength(0);
    // Back home, the rule applies again: no button, and nothing in ⋯.
    await act(async () => void (await jali.actions.focus("a")));
    expect(popButton("a")).toBeNull();
  });
});
