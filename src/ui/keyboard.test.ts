/**
 * The keyboard ladder (commands/keyboard.ts): content first, then the pane layer; ⌘Z is the content's; the Esc
 * ladder runs content → drag → peek → maximise; the keymap is per store, overridable, and refuses bare character keys.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installKeyboard } from "./commands/keyboard";
import { createKeymap } from "./commands/keymap";
import { formatKeys, parseKeys, type Chord } from "./commands/format";
import { createLabStore } from "../lab";
import type { UiStore } from "./state/store";


let store: UiStore;
let off: () => void;
let content: HTMLElement;

/** A keydown dispatched at `target` (bubbling through document to window), as a browser would. */
function keydown(target: EventTarget, init: KeyboardEventInit & { code?: string }) {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}
const mod = () => (store.keymap.platform === "mac" ? { metaKey: true } : { ctrlKey: true });
const chord = (target: EventTarget, text: string) => {
  let last!: KeyboardEvent;
  for (const c of parseKeys(text)) {
    const code = /^(Key|Digit)|^Backslash$|^Bracket/.test(c.key) ? c.key : undefined;
    const key = code ? (code === "Backslash" ? "\\" : code.replace(/^(Key|Digit)/, "").toLowerCase()) : c.key;
    last = keydown(target, { key, code, shiftKey: !!c.shift, altKey: !!c.alt, ...(c.mod ? mod() : {}) });
  }
  return last;
};

function setup(deps: Parameters<typeof createLabStore>[0] = {}) {
  store = createLabStore({ ...deps, initial: { area: { width: 1600, height: 900 }, ...deps.initial } });
  store.actions.preset("order-chain");
  off = installKeyboard(store);
  content = document.createElement("div");
  content.tabIndex = 0;
  document.body.append(content);
}

beforeEach(() => setup());
afterEach(() => {
  off();
  content.remove();
});

describe("content first", () => {
  it("a key the content claims (preventDefault) never reaches the pane layer", () => {
    const focused = store.get().view.focused;
    content.addEventListener("keydown", (e) => e.key === "F6" && e.preventDefault());
    keydown(content, { key: "F6" });
    expect(store.get().view.focused).toBe(focused);
    // Unclaimed, the same key is the pane layer's.
    const other = document.createElement("div");
    document.body.append(other);
    keydown(other, { key: "F6" });
    expect(store.get().view.focused).not.toBe(focused);
    other.remove();
  });

  it("a key the content stops (stopPropagation) never reaches the pane layer either", () => {
    content.addEventListener("keydown", (e) => e.stopPropagation());
    chord(content, "Mod+\\");
    expect(store.model().panes.some((p) => p.ref.kind === "launcher")).toBe(false);
  });

  it("⌘Z / Ctrl+Z belongs to content: the pane layer never restores a closed pane with it", () => {
    const before = store.model().panes.length;
    store.actions.close();
    expect(store.model().panes.length).toBe(before - 1);
    const e = keydown(content, { key: "z", code: "KeyZ", ...mod() });
    expect(e.defaultPrevented).toBe(false); // left for the content (or the browser's own undo in a field)
    expect(store.model().panes.length).toBe(before - 1);
    chord(content, "Mod+K Mod+Z"); // the pane layer's undo has its own chord
    expect(store.model().panes.length).toBe(before);
  });

  it("single character keys, Enter and Space are never taken by the pane layer", () => {
    for (const init of [{ key: "j", code: "KeyJ" }, { key: "k", code: "KeyK" }, { key: " ", code: "Space" }, { key: "Enter" }])
      expect(keydown(content, init).defaultPrevented).toBe(false);
  });

  it('content marked data-pane-keys="content" keeps every key but F6', () => {
    content.dataset.paneKeys = "content";
    expect(chord(content, "Mod+K").defaultPrevented).toBe(false);
    expect(store.get().paletteOpen).toBe(false);
    const focused = store.get().view.focused;
    expect(keydown(content, { key: "F6" }).defaultPrevented).toBe(true);
    expect(store.get().view.focused).not.toBe(focused);
  });
});

describe("the Esc ladder", () => {
  const peekRef = { kind: "record", params: { table: "customers", id: 1 } };
  it("content's Esc first; then the peek; then maximise; then nothing", () => {
    const id = store.get().view.focused!;
    store.actions.toggleZoom(id);
    store.actions.peek(peekRef);
    expect(store.get().view.peek).toBeTruthy();
    // 1. Content uses its Esc (clears a search, cancels an edit): nothing else moves.
    const once = (e: KeyboardEvent) => { e.preventDefault(); content.removeEventListener("keydown", once); };
    content.addEventListener("keydown", once);
    keydown(content, { key: "Escape" });
    expect(store.get().view.peek).toBeTruthy();
    expect(store.get().view.zoomed).toBe(id);
    // 2. The peek.
    expect(keydown(content, { key: "Escape" }).defaultPrevented).toBe(true);
    expect(store.get().view.peek).toBeFalsy();
    expect(store.get().view.zoomed).toBe(id);
    // 3. Maximise.
    keydown(content, { key: "Escape" });
    expect(store.get().view.zoomed).toBeUndefined();
    // 4. Nothing left: the key goes on (the browser stops loading, an outer host may use it).
    expect(keydown(content, { key: "Escape" }).defaultPrevented).toBe(false);
  });

  it("a drag in progress takes Esc before content and before the peek", () => {
    store.actions.peek(peekRef);
    const cancel = vi.fn((e: KeyboardEvent) => { e.preventDefault(); e.stopPropagation(); });
    window.addEventListener("keydown", cancel, true); // what workspace/dnd.ts installs for a drag's lifetime
    const contentEsc = vi.fn();
    content.addEventListener("keydown", contentEsc);
    keydown(content, { key: "Escape" });
    window.removeEventListener("keydown", cancel, true);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(contentEsc).not.toHaveBeenCalled();
    expect(store.get().view.peek).toBeTruthy();
  });

  it("resize mode is modal: arrows and Esc are its own, before content", () => {
    store.actions.enterResizeMode();
    const contentKeys = vi.fn();
    content.addEventListener("keydown", contentKeys);
    keydown(content, { key: "ArrowLeft" });
    keydown(content, { key: "Escape" });
    expect(contentKeys).not.toHaveBeenCalled();
    expect(store.get().resizeMode).toBeNull();
  });
});

describe("chords", () => {
  it("⌘K opens the palette and starts a chord; the second step runs and closes the palette", () => {
    const id = store.get().view.focused!;
    chord(content, "Mod+K");
    expect(store.get().paletteOpen).toBe(true);
    chord(content, "Mod+M");
    expect(store.get().paletteOpen).toBe(false);
    expect(store.get().view.zoomed).toBe(id);
  });

  it("any other key ends the wait: typing in the palette is typing", () => {
    chord(content, "Mod+K");
    keydown(content, { key: "m", code: "KeyM" });
    expect(store.get().paletteOpen).toBe(true);
    chord(content, "Mod+M");
    expect(store.get().view.zoomed).toBeUndefined();
  });

  it("⌘K twice closes the palette, as before", () => {
    chord(content, "Mod+K Mod+K");
    expect(store.get().paletteOpen).toBe(false);
  });

  it("an open dialog owns the keyboard, except the palette chord", () => {
    store.set({ settingsOpen: true });
    chord(content, "Mod+\\");
    expect(store.model().panes.some((p) => p.ref.kind === "launcher")).toBe(false);
  });
});

describe("the keymap", () => {
  it("a host rebinds and unbinds per command, and labels follow", () => {
    off();
    setup({ keymap: { "pane.zoom": "Mod+K Mod+Enter", "pane.split.right": null }, keymapOptions: { platform: "mac" } });
    expect(store.keymap.label("pane.zoom")).toBe("⌘K ⌘↵");
    expect(store.keymap.label("pane.split.right")).toBe("");
    chord(content, "Mod+\\");
    expect(store.model().panes.some((p) => p.ref.kind === "launcher")).toBe(false);
    const id = store.get().view.focused!;
    chord(content, "Mod+K Mod+Enter");
    expect(store.get().view.zoomed).toBe(id);
  });

  it("refuses a bare character key (WCAG 2.1.4) and longer sequences", () => {
    const onInvalid = vi.fn();
    const km = createKeymap({ "pane.zoom": "Z", "pane.close": "Mod+K Mod+X Mod+Y", "pane.tuck": ["Shift+T", "Mod+K Mod+["] }, { onInvalid });
    expect(km.sequences("pane.zoom")).toEqual([]);
    expect(km.sequences("pane.close")).toEqual([]);
    expect(km.sequences("pane.tuck")).toHaveLength(1);
    expect(onInvalid).toHaveBeenCalledTimes(3);
  });

  it("prints ⌘/⌥ on a Mac and Ctrl/Alt elsewhere", () => {
    const mac = createKeymap({}, { platform: "mac" });
    const win = createKeymap({}, { platform: "other" });
    expect(mac.label("pane.zoom")).toBe("⇧⌘↵");
    expect(win.label("pane.zoom")).toBe("Ctrl+Shift+Enter");
    expect(mac.label("pane.move.left")).toBe("⌘K ⇧⌘←");
    expect(win.label("pane.move.left")).toBe("Ctrl+K Ctrl+Shift+Left");
    expect(formatKeys(parseKeys("Alt+Enter"), "other")).toBe("Alt+Enter");
    expect(formatKeys(parseKeys("Alt+Enter"), "mac")).toBe("⌥↵");
  });

  const norm = (c: Chord) => [c.key, !!c.mod, !!c.ctrl, !!c.alt, !!c.shift].join();
  it("no default uses a browser-reserved or OS-taken key", () => {
    // Browser-reserved (the browser acts before the page) or claimed by the OS / assistive tech: see the research doc.
    const banned = ["Mod+W", "Mod+T", "Mod+N", "Shift+Mod+T", "Shift+Mod+N", "Shift+Mod+W", "Mod+Q", "Alt+Mod+ArrowLeft", "Alt+Mod+ArrowRight",
      "Shift+Mod+[", "Shift+Mod+]", "Ctrl+Tab", "Ctrl+PageUp", "Ctrl+PageDown", "Alt+Mod+M", "Alt+Mod+I", "Alt+Mod+J", "Alt+Mod+U", "Mod+L", "Mod+D"]
      .map((t) => norm(parseKeys(t)[0]!));
    const km = createKeymap({}, { platform: "mac" });
    for (const [id, seqs] of km.entries)
      for (const seq of seqs)
        for (const c of seq) {
          expect(banned, `${id}`).not.toContain(norm(c));
          expect(!!(c.mod && c.alt) || !!(c.ctrl && c.alt), `${id}: Ctrl+Alt is AltGr on Windows, ⌃⌥ is VoiceOver`).toBe(false);
          expect(/^Digit/.test(c.key) && c.mod, `${id}: ⌘/Ctrl+digit switches browser tabs`).toBeFalsy();
        }
  });
});

describe("two workspaces on one page", () => {
  it("each takes only the keys from inside its own root, and nothing is shared between them", () => {
    off();
    const a = createLabStore({ initial: { area: { width: 1600, height: 900 } } });
    const b = createLabStore({ initial: { area: { width: 1600, height: 900 } } });
    a.actions.preset("order-chain");
    b.actions.preset("order-chain");
    const rootA = document.createElement("div"), rootB = document.createElement("div");
    const inA = document.createElement("button"), inB = document.createElement("button");
    rootA.append(inA);
    rootB.append(inB);
    document.body.append(rootA, rootB);
    const offA = installKeyboard(a, { root: () => rootA });
    const offB = installKeyboard(b, { root: () => rootB });
    try {
      const fa = a.get().view.focused, fb = b.get().view.focused;
      keydown(inA, { key: "F6" });
      expect(a.get().view.focused).not.toBe(fa);
      expect(b.get().view.focused).toBe(fb);
      keydown(inB, { key: "F6" });
      expect(b.get().view.focused).not.toBe(fb);
      // Each store has its own kinds: registering one in A leaves B untouched.
      a.env.kinds.register({ ...a.env.kinds.get("table")!, kind: "only-in-a" });
      expect(a.env.kinds.get("only-in-a")).toBeDefined();
      expect(b.env.kinds.get("only-in-a")).toBeUndefined();
    } finally {
      offA();
      offB();
      rootA.remove();
      rootB.remove();
      setup();
    }
  });
});

