// @vitest-environment node
/** A workspace renders on a server (Next.js, Astro, any renderToString): no window, no DOM, same markup to hydrate. */
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { act, version } from "react";
import { renderToString } from "react-dom/server";
import { createJali, memoryLocation, memoryStorage, row, type JaliOptions } from "@jali/core";
import { JaliRoot, definePane, useShortcut } from "@jali/react";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => (
    <p>
      Body of note {params.id}. Close it with{" "}
      <kbd data-testid="keys">{useShortcut("pane.close")}</kbd>
    </p>
  ),
});

const make = (options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [note],
    layout: row(note({ id: 1 }), note({ id: 2 })),
    url: { location: memoryLocation() },
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

  // React 18 can't take a store update inside a Suspense boundary that is still hydrating (each pane has one, and the
  // workspace measures itself as it mounts), so there it client-renders the panes after hydration. React 19 can.
  // docs/DECISIONS.md, 20 Nov 2026, "Server rendering on React 18".
  it.skipIf(version.startsWith("18."))(
    "hydrates in a browser without a mismatch: Pop out allowed, a keymap label rendered",
    async () => {
      // The build machine is a Mac (Node has a navigator too); the reader is on Windows, in a browser that can pop out.
      vi.stubGlobal("navigator", { platform: "MacIntel", userAgent: "Node.js" });
      const options: Partial<JaliOptions> = {
        allow: { popOut: true },
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
        await act(async () => {
          hydrateRoot(root, <JaliRoot jali={client} />, { onRecoverableError: recoverable });
        });
        expect(recoverable).not.toHaveBeenCalled();
        // After hydration, the browser's own values: the reader's keys, and Pop out.
        expect(root.querySelector('[data-testid="keys"]')?.textContent).toBe(
          client.keymap.label("pane.close"),
        );
        expect(root.querySelector(".jali-act-popout")).not.toBeNull();
      } finally {
        restore();
      }
    },
  );
});
