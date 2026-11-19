/** Living inside a host app: its own ⌘K menu (palette: false, listCommands, useJaliCommands) and its own keys. */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  createJali,
  listCommands,
  memoryLocation,
  memoryStorage,
  row,
  type JaliOptions,
} from "@jali/core";
import { createKeymap } from "@jali/core/adapter";
import { JaliRoot, JaliView, definePane, useCommands, useJaliCommands } from "@jali/react";

const note = definePane("note", {
  params: { id: Number },
  title: ({ id }) => `Note ${id}`,
  Component: ({ params }) => {
    useCommands([
      { id: "save", title: `Save note ${params.id}`, disabled: "Nothing to save", run: () => {} },
    ]);
    return <p>Note {params.id}</p>;
  },
});

const make = (options: Partial<JaliOptions> = {}) =>
  createJali({
    panes: [note],
    layout: row(note({ id: 1 }), note({ id: 2 })),
    url: { location: memoryLocation() },
    storage: memoryStorage(),
    size: { width: 1200, height: 800 },
    moveFocus: false,
    keymapOptions: { platform: "mac", onInvalid: () => {} },
    ...options,
  });

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

describe("keyPrefix", () => {
  it("moves every default two-step key and the palette's key at once", () => {
    const k = make({ keyPrefix: "Mod+J" }).keymap;
    expect(k.label("palette.toggle")).toBe("⌘J");
    expect(k.label("pane.undo_close")).toBe("⌘J ⌘Z");
    expect(k.label("pane.split.right")).toBe("⌘\\"); // direct keys stay
  });

  it("leaves the bindings an app writes itself as written", () => {
    const k = make({ keyPrefix: "Mod+J", keymap: { "pane.close": "Mod+K Mod+W" } }).keymap;
    expect(k.label("pane.close")).toBe("⌘K ⌘W");
  });
});

describe("reservedKeys", () => {
  it("drops any binding that is a reserved key or starts with one, and reports each", () => {
    const refused: string[] = [];
    const k = createKeymap(
      {},
      { platform: "mac", reserved: ["Mod+K", "Mod+\\"], onInvalid: (id) => refused.push(id) },
    );
    expect(k.label("palette.toggle")).toBe("");
    expect(k.label("pane.undo_close")).toBe("");
    expect(k.label("pane.split.right")).toBe("");
    expect(k.label("pane.zoom")).toBe("⇧⌘↵"); // its direct key survives; its ⌘K form goes
    expect(refused).toContain("pane.undo_close");
  });

  it("with a moved prefix, only what really clashes goes", () => {
    const k = make({ keyPrefix: "Mod+J", reservedKeys: ["Mod+K"] }).keymap;
    expect(k.label("pane.undo_close")).toBe("⌘J ⌘Z");
  });
});

describe("palette: false", () => {
  it("unbinds the palette's key, unless the app binds it on purpose", () => {
    expect(make({ palette: false }).keymap.label("palette.toggle")).toBe("");
    expect(
      make({ palette: false, keymap: { "palette.toggle": "F1" } }).keymap.label("palette.toggle"),
    ).toBe("F1");
    // The two-step keys still work: the prefix starts a chord without opening anything.
    expect(make({ palette: false }).keymap.label("pane.undo_close")).toBe("⌘K ⌘Z");
  });

  it("renders no palette", () => {
    const jali = make({ palette: false });
    const { container } = render(<JaliRoot jali={jali} />);
    act(() => jali.actions.openPalette());
    expect(document.querySelector(".jali-palette")).toBeNull();
    expect(container.querySelector("[data-jali]")).toBeTruthy();
  });
});

describe("listCommands and useJaliCommands", () => {
  it("lists the focused pane's own commands first, then the workspace's, with keys and reasons", () => {
    const jali = make({ palette: false });
    render(<JaliRoot jali={jali} />);
    const list = listCommands(jali);
    expect(list[0]).toMatchObject({
      key: "pane:save",
      title: "Save note 1",
      group: "Note 1",
      disabled: true,
      reason: "Nothing to save",
    });
    const undo = list.find((c) => c.id === "pane.undo_close")!;
    expect(undo).toMatchObject({ keys: "⌘K ⌘Z", disabled: true });
    expect(new Set(list.map((c) => c.key)).size).toBe(list.length);
  });

  it("runs a command, and the hook follows focus", () => {
    const jali = make({ palette: false });
    let seen: string[] = [];
    function HostMenu() {
      seen = useJaliCommands()
        .filter((c) => c.key.startsWith("pane:"))
        .map((c) => c.title);
      return null;
    }
    render(
      <JaliRoot jali={jali}>
        <HostMenu />
        <JaliView />
      </JaliRoot>,
    );
    expect(seen).toEqual(["Save note 1"]);
    act(() => jali.actions.focus("note-2"));
    expect(seen).toEqual(["Save note 2"]);
    act(() =>
      listCommands(jali)
        .find((c) => c.id === "pane.zoom")!
        .run(),
    );
    expect(jali.get().view.zoomed).toBe("note-2");
  });
});
