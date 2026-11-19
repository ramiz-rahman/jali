/**
 * The packages' public entry points. A change to what "@jali/core" or "@jali/react" exports fails here, so it is made
 * on purpose: update the list, and the docs and changelog with it. "@jali/core/adapter" is for adapters and unchecked.
 */
import { describe, expect, it } from "vite-plus/test";
import * as core from "@jali/core";
import * as react from "@jali/react";

describe("public API", () => {
  it("@jali/core exports exactly these values", () => {
    expect(Object.keys(core).sort()).toEqual([
      "DEFAULT_KEYMAP",
      "GAP",
      "activeItemPort",
      "browserLocation",
      "browserStorage",
      "column",
      "commandsOf",
      "copyLink",
      "createJali",
      "formatKeys",
      "keyHint",
      "layout",
      "listCommands",
      "memoryLocation",
      "memoryStorage",
      "pane",
      "row",
      "runCommand",
      "sameRef",
      "tabs",
      "toLayout",
    ]);
  });

  it("@jali/react exports exactly these values", () => {
    expect(Object.keys(react).sort()).toEqual([
      "Activity",
      "Announcer",
      "Chooser",
      "ConfirmDiscard",
      "CuratedPage",
      "JaliProvider",
      "JaliRoot",
      "JaliView",
      "KindIcon",
      "PageBar",
      "Palette",
      "Panes",
      "SettingsPanel",
      "Shelf",
      "definePage",
      "definePane",
      "useActiveItemPort",
      "useActivity",
      "useCommands",
      "useJali",
      "useJaliCommands",
      "useJaliModel",
      "useJaliState",
      "useLauncher",
      "usePane",
      "usePaneState",
      "useShortcut",
      "useTheme",
      "useUnsaved",
    ]);
  });

  it("a workspace has exactly these members (src/tests/instance.test.ts lists its actions)", () => {
    const jali = core.createJali({
      panes: [{ kind: "note", title: "Note" }],
      layout: { kind: "note", params: {} },
      url: false,
      storage: core.memoryStorage(),
      moveFocus: false,
    });
    expect(Object.keys(jali).sort()).toEqual([
      "actions",
      "env",
      "get",
      "getLayout",
      "href",
      "keymap",
      "model",
      "on",
      "onToast",
      "setLayout",
      "start",
      "subscribe",
    ]);
  });

  it("the layout namespace is the pure tree API", () => {
    expect(Object.keys(core.layout).sort()).toMatchSnapshot();
  });
});
