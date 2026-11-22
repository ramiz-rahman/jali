// @vitest-environment jsdom
/**
 * What an instance keeps lasts as long as the instance, and acts for it alone: a pane's content host after
 * <JaliRoot jali> takes another instance with the same pane ids, a floating window the browser hands back after its
 * instance stopped and started again, and `data-pressed` on controls of an instance without `pressed()` (or none).
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
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { createJali, memoryLocation, memoryStorage, pane, row, tabs } from "@jali/core";
import { JaliRoot, definePane, usePane } from "@jali/react";
import { defaultFeatures, popOut, urlSync } from "./features";

function Note({ id }: { id: string }) {
  const [n, setN] = useState(0);
  const { openBeside } = usePane();
  return (
    <>
      <button type="button" data-counter={id} onClick={() => setN((x) => x + 1)}>
        {id}:{n}
      </button>
      <button type="button" data-beside={id} onClick={() => openBeside(note({ n: 9 }))}>
        Open beside
      </button>
    </>
  );
}
const note = definePane("note", {
  params: { n: Number },
  title: ({ n }) => `Note ${n}`,
  Component: ({ node }) => <Note id={node.id} />,
});
const make = (features = [...defaultFeatures(), popOut()]) =>
  createJali({
    panes: [note],
    layout: row(pane(note({ n: 1 }), { id: "a" }), pane(note({ n: 2 }), { id: "b" })),
    features: [...features, urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    keyboard: { platform: "mac" },
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
/** The browser's answer, held until the test gives it. */
let held: (() => void) | null = null;
let hold = false;

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  window.matchMedia ??= (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
beforeEach(() => {
  hold = false;
  held = null;
  vi.stubGlobal("documentPictureInPicture", {
    window: null,
    requestWindow: () =>
      hold
        ? new Promise<Window>((resolve) => (held = () => resolve(floating())))
        : Promise.resolve(floating()),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  for (const w of windows) w.close();
  windows = [];
});
afterAll(() => {
  Reflect.deleteProperty(window, "isSecureContext");
});

const panes = (jali: ReturnType<typeof make>) => jali.model().panes.length;

describe("an instance's content hosts", () => {
  it("are new for a new instance with the same pane ids: its actions reach the new one, and its state starts over", async () => {
    const j1 = make();
    const j2 = make();
    const { container, rerender } = render(<JaliRoot jali={j1} />);
    const counter = () => container.querySelector<HTMLButtonElement>('[data-counter="a"]')!;
    fireEvent.click(counter());
    fireEvent.click(counter());
    expect(counter().textContent).toBe("a:2");

    rerender(<JaliRoot jali={j2} />);
    // One content element per pane, and the component's own state is the new instance's.
    expect(container.querySelectorAll('[data-counter="a"]')).toHaveLength(1);
    expect(counter().textContent).toBe("a:0");

    const before = panes(j1);
    act(() => void fireEvent.click(container.querySelector('[data-beside="a"]')!));
    expect(panes(j2)).toBe(before + 1);
    expect(panes(j1)).toBe(before);

    await act(async () => void (await j1.actions.focus("b")));
    await act(async () => void (await j2.actions.focus("b")));
    act(() => void fireEvent.pointerDown(counter(), { button: 0, isPrimary: true }));
    expect(j2.get().view.focused).toBe("a");
    expect(j1.get().view.focused).toBe("b");
  });
});

describe("what the panes remember between renders", () => {
  /** The panes' element measures `width`: what the layout reads (useMeasure), changed with a window resize. */
  let width = 1200;
  const sized = (["clientWidth", "clientHeight"] as const).map((prop) => {
    const was = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return this.classList.contains("jali-layout") ? (prop === "clientWidth" ? width : 800) : 0;
      },
    });
    return () => was && Object.defineProperty(HTMLElement.prototype, prop, was);
  });
  afterAll(() => sized.forEach((undo) => undo()));
  const resize = (to: number) => {
    width = to;
    act(() => void window.dispatchEvent(new Event("resize")));
  };
  const tabbed = (active: "a" | "b") =>
    createJali({
      panes: [note],
      layout: row(
        tabs({ active }, pane(note({ n: 1 }), { id: "a" }), pane(note({ n: 2 }), { id: "b" })),
        pane(note({ n: 3 }), { id: "c" }),
      ),
      features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
      storage: memoryStorage(),
      size: { width: 1200, height: 800 },
      moveFocus: false,
    });
  /** The tab group's shown tab. */
  const activeTab = (jali: ReturnType<typeof tabbed>) =>
    (jali.model().layout.root as { children: readonly { active?: string }[] }).children[0]!.active;

  it("starts over with a new instance: one pane at a time in the old one restores nothing in the new one", () => {
    width = 1200;
    const a = tabbed("a");
    const b = tabbed("b");
    const { rerender } = render(<JaliRoot jali={a} />);
    resize(400);
    expect(a.model().onePane).toBe(true);
    width = 1200;
    rerender(<JaliRoot jali={b} />);
    expect(b.model().onePane).toBe(false);
    expect(activeTab(b)).toBe("b");
  });
});

describe("an instance given back to the root", () => {
  it("gets its own hosts again: one content element per pane, and its actions reach it", () => {
    const j1 = make();
    const j2 = make();
    const { container, rerender } = render(<JaliRoot jali={j1} />);
    rerender(<JaliRoot jali={j2} />);
    rerender(<JaliRoot jali={j1} />);
    expect(container.querySelectorAll('[data-counter="a"]')).toHaveLength(1);
    expect(container.querySelectorAll("[data-jali-host]")).toHaveLength(
      container.querySelectorAll(".jali-pane-content").length,
    );
    const before = { j1: panes(j1), j2: panes(j2) };
    act(() => void fireEvent.click(container.querySelector('[data-beside="a"]')!));
    expect(panes(j1)).toBe(before.j1 + 1);
    expect(panes(j2)).toBe(before.j2);
  });
});

describe("a floating window the browser hands back late", () => {
  it("is dropped when its instance stopped and started again meanwhile; a new request still opens", async () => {
    const jali = make();
    const first = render(<JaliRoot jali={jali} />);
    await act(async () => void (await jali.actions.focus("a")));
    hold = true;
    await act(async () => {
      fireEvent.click(first.container.querySelector('[aria-label="Pop out Note 1"]')!);
      await Promise.resolve();
    });
    expect(held).toBeTruthy();
    first.unmount();

    const { container } = render(<JaliRoot jali={jali} />);
    await act(async () => {
      held!();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(open()).toHaveLength(0);
    expect(container.querySelector(".jali-popped-out")).toBeNull();

    hold = false;
    await act(async () => void (await jali.actions.focus("a")));
    await act(async () => {
      fireEvent.click(container.querySelector('[aria-label="Pop out Note 1"]')!);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(open()).toHaveLength(1);
    expect(container.querySelector(".jali-popped-out")).toBeTruthy();
  });
});

describe("data-pressed", () => {
  it("is only on the controls of an instance with pressed()", () => {
    const withIt = make();
    const without = make(defaultFeatures().filter((f) => f.id !== "pressed"));
    const { container } = render(
      <>
        <div data-on="">
          <JaliRoot jali={withIt} />
        </div>
        <div data-off="">
          <JaliRoot jali={without} />
        </div>
        <button type="button" data-menu-item="" data-app="">
          The app's own
        </button>
      </>,
    );
    const close = (where: string) =>
      container.querySelector<HTMLElement>(`[${where}] .jali-pane-action[data-action="close"]`)!;
    const hold = (el: HTMLElement) => {
      act(() => void fireEvent.pointerDown(el, { button: 0, isPrimary: true }));
      const on = el.hasAttribute("data-pressed");
      act(() => void fireEvent.pointerUp(el, { button: 0, isPrimary: true }));
      return on;
    };
    expect(hold(close("data-on"))).toBe(true);
    expect(hold(close("data-off"))).toBe(false);
    expect(hold(container.querySelector<HTMLElement>("[data-app]")!)).toBe(false);
  });

  it("is not on the controls of an instance without it, nested in the root of one with it", () => {
    const outer = make();
    const inner = make(defaultFeatures().filter((f) => f.id !== "pressed"));
    const { container } = render(
      <JaliRoot jali={outer}>
        <div data-inner="">
          <JaliRoot jali={inner} />
        </div>
      </JaliRoot>,
    );
    const close = container.querySelector<HTMLElement>(
      '[data-inner] .jali-pane-action[data-action="close"]',
    )!;
    expect(close.closest("[data-jali]")?.parentElement?.closest("[data-jali]")).toBeTruthy();
    act(() => void fireEvent.pointerDown(close, { button: 0, isPrimary: true }));
    expect(close.hasAttribute("data-pressed")).toBe(false);
    act(() => void fireEvent.pointerUp(close, { button: 0, isPrimary: true }));
  });
});
