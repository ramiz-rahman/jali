/**
 * The packages' public entry points. A change to what "@jali/core" or "@jali/react" exports fails here, so it is made
 * on purpose: update the list, and the docs and changelog with it. "@jali/core/adapter" is for adapters: only its
 * shape is checked here (an explicit list of names).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import * as core from "@jali/core";
import * as adapter from "@jali/core/adapter";
import * as react from "@jali/react";

describe("public API", () => {
  it("@jali/core exports exactly these values", () => {
    expect(Object.keys(core).sort()).toEqual([
      "altClick",
      "appOnly",
      "column",
      "copyLink",
      "createJali",
      "edgeScroll",
      "en",
      "keyBelongsToContent",
      "keyHint",
      "listCommands",
      "memoryLocation",
      "memoryStorage",
      "oneOf",
      "optional",
      "pane",
      "row",
      "runCommand",
      "sameRef",
      "tabs",
    ]);
  });

  it("@jali/react exports exactly these values", () => {
    expect(Object.keys(react).sort()).toEqual([
      "Activity",
      "IconButton",
      "JaliRoot",
      "JaliView",
      "KindIcon",
      "PageBar",
      "Shelf",
      "appOnly",
      "definePage",
      "definePane",
      "keyBelongsToContent",
      "oneOf",
      "optional",
      "useActivity",
      "useCommands",
      "useHeaderActions",
      "useJali",
      "useJaliEvent",
      "useJaliModel",
      "useJaliShortcut",
      "useJaliState",
      "useJaliTheme",
      "useLauncher",
      "usePane",
      "usePaneAttributes",
      "usePaneState",
      "useTitle",
      "useUnsaved",
    ]);
  });

  it("a workspace has exactly these members (src/tests/instance.test.ts lists its actions)", () => {
    const jali = core.createJali({
      panes: [{ kind: "note", title: "Note" }],
      layout: { kind: "note", params: {} },
      storage: core.memoryStorage(),
      moveFocus: false,
    });
    expect(Object.keys(jali).sort()).toEqual([
      "actions",
      "destroy",
      "dialogs",
      "get",
      "getLayout",
      "href",
      "keymap",
      "messages",
      "model",
      "on",
      "presets",
      "setLayout",
      "start",
      "subscribe",
    ]);
  });

  it("the layout namespace, in @jali/core/adapter, is the pure tree API", () => {
    expect(Object.keys(adapter.layout).sort()).toMatchSnapshot();
  });

  it("an app reads its own state and model, not the engine's", () => {
    expectTypeOf<keyof core.JaliState>().toEqualTypeOf<
      | "layout"
      | "page"
      | "view"
      | "presetId"
      | "selection"
      | "settings"
      | "unsaved"
      | "activity"
      | "resizeMode"
    >();
    expectTypeOf<keyof core.JaliState["view"]>().toEqualTypeOf<"focused" | "zoomed" | "peek">();
    expectTypeOf<keyof core.JaliModel>().toEqualTypeOf<"panes" | "pane" | "paneOf">();
    expectTypeOf<keyof core.PaneOf>().toEqualTypeOf<
      | "id"
      | "ref"
      | "title"
      | "where"
      | "focused"
      | "box"
      | "selected"
      | "linkedTo"
      | "follows"
      | "kept"
      | "pinned"
    >();
    const jali = core.createJali({
      panes: [{ kind: "note", title: "Note" }],
      layout: { kind: "note", params: {} },
      storage: core.memoryStorage(),
      size: { width: 800, height: 600 },
      moveFocus: false,
    });
    expect(Object.keys(jali.get()).sort()).toEqual([
      "activity",
      "layout",
      "page",
      "presetId",
      "resizeMode",
      "selection",
      "settings",
      "unsaved",
      "view",
    ]);
    expect(Object.keys(jali.model()).sort()).toEqual(["pane", "paneOf", "panes"]);
  });

  it("@jali/core/adapter lists its names: nothing reaches it by `export *` but the public API and the layout namespace", () => {
    const source = readFileSync(join(import.meta.dirname, "../../core/src/adapter.ts"), "utf8");
    expect([...source.matchAll(/^export (?:type )?\* .*$/gm)].map((m) => m[0])).toEqual([
      'export * from "./index";',
      'export * as layout from "./layout";',
    ]);
  });

  it("a URL writer reads the address's share of the state, not the workspace's whole state", () => {
    expectTypeOf<Parameters<core.UrlWriter["write"]>[0]>().toEqualTypeOf<() => core.UrlState>();
    expectTypeOf<keyof core.UrlState>().toEqualTypeOf<"layout" | "view" | "presetId" | "page">();
    const seen: string[][] = [];
    const jali = core.createJali({
      panes: [{ kind: "note", title: "Note" }],
      layout: { kind: "note", params: {} },
      url: { write: (state, mode) => mode !== "none" && seen.push(Object.keys(state())) },
      storage: core.memoryStorage(),
      size: { width: 800, height: 600 },
      moveFocus: false,
    });
    jali.actions.toggleZoom();
    expect(seen.length).toBeGreaterThan(0);
    for (const keys of seen) expect(keys.sort()).toEqual(["layout", "page", "presetId", "view"]);
  });
});
