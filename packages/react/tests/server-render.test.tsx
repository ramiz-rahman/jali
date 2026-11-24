// @vitest-environment node
/** A workspace renders on a server (Next.js, Astro, any renderToString): no window, no DOM, same markup to hydrate. */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
// From Testing Library, as the other tests do: React exports `act` itself only from 18.3, and Jali supports 18.2.
import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createJali, memoryLocation, memoryStorage, row, type JaliOptions } from "@jali/core";
import { storeOf } from "@jali/core/adapter";
import { JaliRoot, definePane, useJaliShortcut } from "@jali/react";
import { defaultFeatures, popOut, urlSync } from "./features";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => (
    <p>
      Body of note {params.id}. Close it with{" "}
      <kbd data-testid="keys">{useJaliShortcut("pane.close")}</kbd>
    </p>
  ),
});

/** A pane whose content waits for its data in the browser (the server had it): `slow.ready()` lets it show. */
const slow = (() => {
  let waiting: { promise: Promise<void>; resolve: () => void } | null = null;
  const kind = definePane("slow", {
    params: { id: Number },
    title: ({ id }) => `Slow ${id}`,
    Component: () => {
      if (waiting) throw waiting.promise;
      return <p data-testid="slow">Slow body</p>;
    },
  });
  return {
    kind,
    wait() {
      let resolve = () => {};
      const promise = new Promise<void>((r) => (resolve = r));
      waiting = { promise, resolve };
    },
    ready() {
      const was = waiting;
      waiting = null;
      was?.resolve();
      return was?.promise;
    },
  };
})();

const make = (options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [note, slow.kind],
    layout: row(note({ id: 1 }), note({ id: 2 })),
    features: [...defaultFeatures(), urlSync({ location: memoryLocation() })],
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    ...options,
  });

/** jsdom (the unit tests' DOM), typed as far as this test uses it: the repo has no `@types/jsdom`. */
type JsdomCtor = new (
  html: string,
  options: { url: string; pretendToBeVisual: boolean },
) => { window: Window & { close(): void } };

/**
 * A browser for the rest of the test: jsdom's window as the globals React and Jali read, a reader on Windows in a
 * browser that can pop panes out (Document Picture-in-Picture, a secure page). Returns the restore.
 */
async function browser(html: string): Promise<{ root: HTMLElement; restore: () => void }> {
  const jsdom = "jsdom";
  const { JSDOM } = (await import(/* @vite-ignore */ jsdom)) as { JSDOM: JsdomCtor };
  const dom = new JSDOM(`<!doctype html><html><body><div id="root">${html}</div></body></html>`, {
    url: "https://jali.test/",
    pretendToBeVisual: true,
  });
  const win = dom.window as unknown as Window & Record<string, unknown>;
  Object.defineProperty(win.navigator, "platform", { value: "Win32", configurable: true });
  Object.defineProperty(win, "isSecureContext", { value: true, configurable: true });
  win.documentPictureInPicture = { requestWindow: async () => win, window: null };
  win.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  win.matchMedia ??= () =>
    ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }) as unknown as MediaQueryList;
  const g = globalThis as Record<string, unknown>;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const put = (key: string, value: unknown) => {
    if (!saved.has(key)) saved.set(key, Object.getOwnPropertyDescriptor(g, key));
    Object.defineProperty(g, key, { value, configurable: true, writable: true });
  };
  for (const key of Object.getOwnPropertyNames(win)) {
    if (key in g && !["window", "document", "navigator", "self", "location"].includes(key))
      continue;
    try {
      put(key, (win as Record<string, unknown>)[key]);
    } catch {
      // A property jsdom won't hand over: React and Jali don't need it.
    }
  }
  for (const key of ["window", "self"]) put(key, win);
  put("IS_REACT_ACT_ENVIRONMENT", true);
  return {
    root: win.document.getElementById("root") as unknown as HTMLElement,
    restore() {
      for (const [key, d] of saved) {
        if (d) Object.defineProperty(g, key, d);
        else delete g[key];
      }
      dom.window.close();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("server rendering", () => {
  it("renders <JaliRoot> to HTML without a browser", () => {
    expect(typeof window).toBe("undefined");
    const jali = make();
    const html = renderToString(<JaliRoot jali={jali} />);
    expect(html).toContain("jali-");
    expect(html).toContain("Note 1");
  });

  // On React 18 too. Each pane's Suspense boundary hydrates after the rest of the page, and React 18 throws a boundary's
  // server markup away if an update reaches it first; so the workspace measures itself once its panes have hydrated.
  // docs/DECISIONS.md, 21 Nov 2026, "Server rendering on React 18: the panes keep the server's markup".
  it("hydrates in a browser without a mismatch: Pop out allowed, a keymap label rendered", async () => {
    // The build machine is a Mac (Node has a navigator too); the reader is on Windows, in a browser that can pop out.
    vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "Node.js" });
    const options: Partial<JaliOptions> = {
      features: [popOut()],
      buttons: (d) => [...d, "popOut"],
    };
    const html = renderToString(<JaliRoot jali={make(options)} />);
    vi.unstubAllGlobals();
    // Keys print for "other" until hydration, whatever the build machine; Pop out waits for the browser.
    expect(html).toContain('<kbd data-testid="keys">Ctrl+K Ctrl+Backspace</kbd>');
    expect(html).not.toContain("jali-act-popout");

    const { root, restore } = await browser(html);
    try {
      const { hydrateRoot } = await import("react-dom/client");
      const recoverable = vi.fn();
      const client = make(options);
      expect(client.keymap.platform).toBe("other");
      const serverKeys = root.querySelector('[data-testid="keys"]');
      await act(async () => {
        hydrateRoot(root, <JaliRoot jali={client} />, { onRecoverableError: recoverable });
      });
      expect(recoverable).not.toHaveBeenCalled();
      // The server's elements, kept: React hydrated them rather than rendering the panes again.
      expect(root.querySelector('[data-testid="keys"]')).toBe(serverKeys);
      // After hydration, the browser's own values: the reader's keys, and Pop out.
      expect(serverKeys?.textContent).toBe(client.keymap.label("pane.close"));
      expect(root.querySelector(".jali-act-popout")).not.toBeNull();
      // And the workspace measured itself: jsdom lays nothing out, so it has no room. Its second pane pauses, which
      // is the update React 18 would have taken out on the pane's server markup.
      expect(storeOf(client).get().area).toEqual({ width: 0, height: 0 });
    } finally {
      restore();
    }
  });

  it("waits to measure while a pane's content waits for its data in the browser, then measures", async () => {
    const options: Partial<JaliOptions> = { layout: row(note({ id: 1 }), slow.kind({ id: 2 })) };
    const html = renderToString(<JaliRoot jali={make(options)} />);
    expect(html).toContain("Slow body");

    const { root, restore } = await browser(html);
    try {
      const { hydrateRoot } = await import("react-dom/client");
      const recoverable = vi.fn();
      const client = make(options);
      const store = storeOf(client);
      const serverSlow = root.querySelector('[data-testid="slow"]');
      slow.wait();
      await act(async () => {
        hydrateRoot(root, <JaliRoot jali={client} />, { onRecoverableError: recoverable });
      });
      // The slow pane is still the server's markup, so the workspace keeps the server's size meanwhile.
      expect(store.get().area).toEqual({ width: 1200, height: 800 });
      expect(root.querySelector('[data-testid="slow"]')).toBe(serverSlow);

      await act(async () => {
        await slow.ready();
      });
      expect(recoverable).not.toHaveBeenCalled();
      expect(root.querySelector('[data-testid="slow"]')).toBe(serverSlow);
      expect(store.get().area).toEqual({ width: 0, height: 0 });
    } finally {
      slow.ready();
      restore();
    }
  });

  it("measures on its first commit when rendered in the browser alone", async () => {
    const { root, restore } = await browser("");
    try {
      const { createRoot } = await import("react-dom/client");
      const client = make({ layout: row(note({ id: 1 }), slow.kind({ id: 2 })) });
      slow.wait();
      const app = createRoot(root);
      await act(async () => app.render(<JaliRoot jali={client} />));
      // A pane still loading holds nothing back: there is no server markup to keep.
      expect(root.querySelector('[data-testid="slow"]')).toBeNull();
      expect(storeOf(client).get().area).toEqual({ width: 0, height: 0 });
      await act(async () => app.unmount());
    } finally {
      slow.ready();
      restore();
    }
  });
});
