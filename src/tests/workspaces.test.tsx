/// <reference types="vite/client" />
/**
 * More than one workspace on a page, and start-up (docs/FINDINGS-FROM-DOCS.md 1, 2, 3, 9–12, 18, 25, 27, 28):
 * each store's keys, dialogs, storage, theme and tokens stay its own, and mounting never takes the page's focus.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import shelfCss from "../../packages/react/src/styles/shelf.css?raw";
import chromeCss from "../../packages/react/src/styles/chrome.css?raw";
import * as core from "@jali/core";
import { createUrlSync, installKeyboard, memoryLocation, startUi, type UiStore } from "@jali/core";
import { Jali, JaliView, definePaneKind } from "@jali/react";
import { parseKeys } from "../../packages/core/src/commands/format";
import { createLabStore } from "../lab";

const area = { width: 1600, height: 900 };
const make = (deps: Parameters<typeof createLabStore>[0] = {}) => {
  const s = createLabStore({ focusPane: null, ...deps, initial: { area, ...deps.initial } });
  s.actions.preset("order-chain");
  return s;
};

function keydown(target: EventTarget, init: KeyboardEventInit & { code?: string }) {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}
const chordAt = (store: UiStore, target: () => EventTarget, text: string) => {
  const mod = store.keymap.platform === "mac" ? { metaKey: true } : { ctrlKey: true };
  for (const c of parseKeys(text)) {
    const code = /^(Key|Digit)|^Backslash$|^Bracket/.test(c.key) ? c.key : undefined;
    const key = code ? (code === "Backslash" ? "\\" : code.replace(/^(Key|Digit)/, "").toLowerCase()) : c.key;
    act(() => { keydown(target(), { key, code, shiftKey: !!c.shift, altKey: !!c.alt, ...(c.mod ? mod : {}) }); });
  }
};

class RO { observe() {} unobserve() {} disconnect() {} }
vi.stubGlobal("ResizeObserver", (globalThis as { ResizeObserver?: unknown }).ResizeObserver ?? RO);

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
});

describe("keys scoped to a root (1, 12)", () => {
  it("a ⌘K chord finishes in the palette, which renders outside the root", () => {
    const a = make({ id: "a" }), b = make({ id: "b" });
    const r = render(<><Jali store={a}><button>in a</button></Jali><Jali store={b}><button>in b</button></Jali></>);
    // store.dom.root fits KeyboardScope.root as it is.
    const offA = installKeyboard(a, { root: a.dom.root });
    const offB = installKeyboard(b, { root: b.dom.root });
    try {
      const inA = r.getByText("in a");
      inA.focus();
      const focused = a.get().view.focused!;
      chordAt(a, () => document.activeElement ?? inA, "Mod+K Mod+M");
      expect(a.get().view.zoomed).toBe(focused);
      expect(a.get().paletteOpen).toBe(false);
      expect(b.get().view.zoomed).toBeFalsy();
      expect(b.get().paletteOpen).toBe(false);
    } finally {
      offA();
      offB();
    }
  });
});

describe("dialog ids (2)", () => {
  it("two workspaces' dialogs never share an element id", () => {
    const a = make({ id: "a" }), b = make({ id: "b" });
    render(<><Jali store={a} /><Jali store={b} /></>);
    for (const s of [a, b]) act(() => s.set({ settingsOpen: true }));
    for (const s of [a, b]) act(() => s.set({ confirm: { panes: [s.get().view.focused!], change: { kind: "close" } as never } }));
    let ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of [a, b]) act(() => s.set({ settingsOpen: false, confirm: null, paletteOpen: true }));
    ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    expect(ids.filter((i) => i.includes("palette")).length).toBe(2);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("default storage (3)", () => {
  it("two stores with their own ids save under their own prefixes", () => {
    const a = core.createUiStore({ kinds: core.createPaneKinds([]), initial: { layout: make().get().layout }, id: "orders", focusPane: null });
    const b = core.createUiStore({ kinds: core.createPaneKinds([]), initial: { layout: make().get().layout }, id: "notes", focusPane: null });
    a.storage.set("k", "A");
    b.storage.set("k", "B");
    expect(a.storage.get("k")).toBe("A");
    expect(b.storage.get("k")).toBe("B");
  });
  it("the default store keeps its old prefix", () => {
    const s = core.createUiStore({ kinds: core.createPaneKinds([]), initial: { layout: make().get().layout }, focusPane: null });
    s.storage.set("k", "v");
    expect(localStorage.getItem("jali:k")).toBe("v");
  });
  it("two URL syncs with their own prefixes keep their own broken link", () => {
    const loc = memoryLocation("");
    createUrlSync({ location: loc }).keepBroken("one");
    createUrlSync({ location: loc, prefix: "n." }).keepBroken("two");
    expect(localStorage.getItem("jali:broken-layout")).toBe("one");
    expect(localStorage.getItem("jali:n.broken-layout")).toBe("two");
  });
});

describe("startUi for one of several workspaces (9, 10, 11)", () => {
  it("theme: false leaves <html> alone", () => {
    const s = make();
    const off = startUi(s, { theme: false });
    act(() => s.set({ settings: { ...s.get().settings, theme: "dark" } }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    off();
  });
  it("by default it still writes the theme", () => {
    const s = make();
    const off = startUi(s);
    act(() => s.set({ settings: { ...s.get().settings, theme: "dark" } }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    off();
  });
  it("root scopes its keys, and settings still save", () => {
    const a = make({ id: "a" }), b = make({ id: "b" });
    const rootA = document.createElement("div"), rootB = document.createElement("div");
    const inA = document.createElement("button"), inB = document.createElement("button");
    rootA.append(inA); rootB.append(inB); document.body.append(rootA, rootB);
    const offA = startUi(a, { root: () => rootA, theme: false });
    const offB = startUi(b, { root: () => rootB, theme: false });
    try {
      const fa = a.get().view.focused, fb = b.get().view.focused;
      keydown(inB, { key: "F6" });
      expect(a.get().view.focused).toBe(fa);
      expect(b.get().view.focused).not.toBe(fb);
      a.set({ settings: { ...a.get().settings, paneCap: 5 } });
      expect(JSON.parse(a.storage.get("settings") ?? "{}").paneCap).toBe(5);
    } finally {
      offA(); offB(); rootA.remove(); rootB.remove();
    }
  });
  it("still takes a URL sync as its second argument", () => {
    const s = make();
    const off = startUi(s, createUrlSync({ location: memoryLocation("") }));
    off();
  });
  it("writes no unprefixed or lab variables on <html>", () => {
    const s = make();
    const off = startUi(s);
    const style = document.documentElement.getAttribute("style") ?? "";
    for (const v of ["--gap", "--topbar-h", "--status-h", "--switcher-h"]) expect(style).not.toMatch(new RegExp(`(^|[ ;])${v}:`));
    off();
  });
});

describe("host commands (18)", () => {
  it("a host's own command can be bound and runs from its keys", () => {
    const run = vi.fn();
    const s = make({ commands: [{ id: "host.hello", title: "Say hello", group: "Host", run }], keymap: { "host.hello": "Mod+K Mod+H" } });
    expect(core.commandsOf(s).some((c) => c.id === "host.hello")).toBe(true);
    const off = installKeyboard(s);
    chordAt(s, () => document.body, "Mod+K Mod+H");
    expect(run).toHaveBeenCalledTimes(1);
    off();
  });
});

describe("mounting (25)", () => {
  it("a workspace mounting leaves page focus where it was", async () => {
    const note = definePaneKind({
      kind: "note", title: (ref) => `Note ${ref.params.id}`, ref: (params) => ({ kind: "note", params }), minWidth: 200, minHeight: 100,
      Component: ({ ref }) => <button>note {String(ref.params.id)}</button>,
    });
    const layout: core.Layout = { version: 1, root: { id: "root", type: "row", size: { weight: 1 }, children: [
      { id: "a", type: "pane", size: { weight: 1 }, ref: { kind: "note", params: { id: 1 } } },
      { id: "b", type: "pane", size: { weight: 1 }, ref: { kind: "note", params: { id: 2 } } },
    ] } };
    const s = core.createUiStore({ kinds: core.createPaneKinds([note]), initial: { layout, area } });
    core.boot(s);
    document.body.focus();
    render(<Jali store={s}><JaliView /></Jali>);
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(document.activeElement).toBe(document.body);
  });
});

describe("tokens and the shelf (27, 28)", () => {
  it("GAP is public", () => {
    expect(core.GAP).toBe(6);
  });
  it("the shelf's phone rule needs no host class", () => {
    const css = shelfCss;
    expect(css).not.toMatch(/\.app\b/);
    const chrome = chromeCss;
    expect(chrome).not.toMatch(/var\(--switcher-h\)/);
  });
});
