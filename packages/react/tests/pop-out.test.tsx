// @vitest-environment jsdom
/**
 * Pop out as a stable feature (react-opus REACT-11, react-codex REACT-9, core-opus CORE-11, core-codex CORE-11), with
 * a fake Document Picture-in-Picture whose "window" is an iframe's: the window is the workspace's own (one per
 * workspace, no module state), the content moves into it whole and comes back whole (its `useState` survives), Jali's
 * keys work there, a refused request resolves false, and the window closes on unmount, `destroy()` and a store swap.
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
import { createJali, memoryLocation, memoryStorage, pane, row } from "@jali/core";
import { JaliRoot, definePane } from "@jali/react";
import { defaultFeatures, popOut, urlSync } from "./features";

function Counter({ id }: { id: string }) {
  const [n, setN] = useState(0);
  return (
    <button type="button" data-counter={id} onClick={() => setN((x) => x + 1)}>
      {id}:{n}
    </button>
  );
}
const note = definePane("note", {
  params: { n: Number },
  title: ({ n }) => `Note ${n}`,
  Component: ({ node }) => <Counter id={node.id} />,
});
const make = (options: { scope?: "page" | "local" } = {}) =>
  createJali({
    panes: [note],
    layout: row(pane(note({ n: 1 }), { id: "a" }), pane(note({ n: 2 }), { id: "b" })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() }), popOut()],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    keyboard: { platform: "mac", ...(options.scope ? { scope: options.scope } : {}) },
  });

/** A floating window, as the browser's: an iframe's window, closed by taking the iframe out and saying `pagehide`. */
let windows: Window[] = [];
const closed = new WeakSet<Window>();
let refuse = false;
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
  refuse = false;
  vi.stubGlobal("documentPictureInPicture", {
    window: null,
    requestWindow: async () => {
      if (refuse) throw new DOMException("No user activation", "NotAllowedError");
      return floating();
    },
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

const popOutButton = (c: HTMLElement, title: string) =>
  c.querySelector<HTMLButtonElement>(`[aria-label="Pop out ${title}"]`);

describe("Pop out, the workspace's own window", () => {
  it("moves the content into the window whole, and back: its own state survives both ways", async () => {
    const jali = make();
    const { container } = render(<JaliRoot jali={jali} />);
    const counter = () =>
      (open()[0]?.document ?? document).querySelector<HTMLButtonElement>('[data-counter="a"]')!;
    fireEvent.click(counter());
    fireEvent.click(counter());
    expect(counter().textContent).toBe("a:2");
    await act(async () => void (await jali.actions.focus("a")));
    await act(async () => {
      fireEvent.click(popOutButton(container, "Note 1") ?? container);
      await Promise.resolve();
    });
    // The window has the content (the same element, still at 2), with [data-jali] on its root.
    const [win] = open();
    expect(win).toBeTruthy();
    expect(win!.document.querySelector(".jali-popout")?.hasAttribute("data-jali")).toBe(true);
    expect(counter().ownerDocument).toBe(win!.document);
    expect(counter().textContent).toBe("a:2");
    expect(container.querySelector(".jali-popped-out")?.textContent).toContain(
      "Popped out into its own window",
    );
    fireEvent.click(counter());
    expect(counter().textContent).toBe("a:3");
    // Bring back: the window closes, and the content is home, still at 3.
    act(() =>
      fireEvent.click(container.querySelector<HTMLButtonElement>(".jali-popped-out button")!),
    );
    expect(open()).toHaveLength(0);
    expect(counter().ownerDocument).toBe(document);
    expect(counter().textContent).toBe("a:3");
  });

  it("takes Jali's keys in the window, whatever keyboard.scope says", async () => {
    const jali = make({ scope: "local" });
    const { container } = render(<JaliRoot jali={jali} />);
    await act(async () => {
      jali.actions.focus("a");
      fireEvent.click(popOutButton(container, "Note 1")!);
      await Promise.resolve();
    });
    const doc = open()[0]!.document;
    const target = doc.querySelector("[data-counter]")!;
    // ⌘K ⌘M in the window maximises the focused pane.
    const press = (key: string) =>
      target.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          code: `Key${key.toUpperCase()}`,
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    act(() => {
      press("k");
      press("m");
    });
    expect(jali.get().view.zoomed).toBe("a");
  });

  it("keeps one window per workspace: popping out another pane brings the first back", async () => {
    const jali = make();
    const { container } = render(<JaliRoot jali={jali} />);
    await act(async () => {
      fireEvent.click(popOutButton(container, "Note 1")!);
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.click(popOutButton(container, "Note 2")!);
      await Promise.resolve();
    });
    expect(open()).toHaveLength(1);
    expect(open()[0]!.document.querySelector('[data-counter="b"]')).not.toBeNull();
    expect(document.querySelector('[data-counter="a"]')).not.toBeNull();
  });

  it("resolves false when the browser refuses the window, and nothing changes", async () => {
    refuse = true;
    const jali = make();
    const { container } = render(<JaliRoot jali={jali} />);
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    await act(async () => {
      fireEvent.click(popOutButton(container, "Note 1")!);
      await new Promise((r) => setTimeout(r, 0));
    });
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(open()).toHaveLength(0);
    expect(container.querySelector(".jali-popped-out")).toBeNull();
  });

  it.each([
    ["its root unmounts", (r: ReturnType<typeof render>) => r.unmount()],
    ["destroy()", (_r: ReturnType<typeof render>, jali: ReturnType<typeof make>) => jali.destroy()],
    [
      "another workspace takes the root",
      (r: ReturnType<typeof render>) => r.rerender(<JaliRoot jali={make()} />),
    ],
  ])("closes the window when %s", async (_, end) => {
    const jali = make();
    const r = render(<JaliRoot jali={jali} />);
    await act(async () => {
      fireEvent.click(popOutButton(r.container, "Note 1")!);
      await Promise.resolve();
    });
    expect(open()).toHaveLength(1);
    act(() => end(r, jali));
    expect(open()).toHaveLength(0);
  });

  it("drops a window the browser gives after the workspace stopped", async () => {
    let give!: (w: Window) => void;
    vi.stubGlobal("documentPictureInPicture", {
      window: null,
      requestWindow: () => new Promise<Window>((resolve) => (give = resolve)),
    });
    const jali = make();
    const r = render(<JaliRoot jali={jali} />);
    act(() => void fireEvent.click(popOutButton(r.container, "Note 1")!));
    r.unmount();
    const late = floating();
    await act(async () => {
      give(late);
      await Promise.resolve();
    });
    expect(open()).toHaveLength(0);
  });
});
