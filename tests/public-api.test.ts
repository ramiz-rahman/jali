/**
 * The packages' public entry points. A change to what "@jali/core", "@jali/react", "@jali/react/icons" or "@jali/core/agent" exports fails here, so it is made
 * on purpose: update the list, and the docs and changelog with it. "@jali/core/adapter" is for adapters and unchecked.
 */
import { describe, expect, it } from "vite-plus/test";
import * as core from "@jali/core";
import * as react from "@jali/react";
import * as icons from "@jali/react/icons";
import * as agent from "@jali/core/agent";

describe("public API", () => {
  it("@jali/core exports exactly these values", () => {
    expect(Object.keys(core).sort()).toEqual([
      "DEFAULT_KEYMAP",
      "GAP",
      "activeItemPort",
      "altClick",
      "browserLocation",
      "browserStorage",
      "column",
      "commandsOf",
      "copyLink",
      "createJali",
      "edgeScroll",
      "en",
      "formatKeys",
      "keyHint",
      "layout",
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
      "keyBelongsToContent",
      "oneOf",
      "optional",
      "unstable_bringBack",
      "unstable_canPopOut",
      "unstable_popOut",
      "useActiveItemPort",
      "useActivity",
      "useCommands",
      "useHeaderActions",
      "useJali",
      "useJaliCommands",
      "useJaliIcons",
      "useJaliModel",
      "useJaliState",
      "useLauncher",
      "usePane",
      "usePaneAttributes",
      "usePaneState",
      "useShortcut",
      "useTheme",
      "useTitle",
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
      "destroy",
      "env",
      "get",
      "getLayout",
      "href",
      "keymap",
      "messages",
      "model",
      "on",
      "onToast",
      "setLayout",
      "start",
      "subscribe",
    ]);
  });

  it("@jali/react/icons exports Jali's default set, with an icon for every name", () => {
    expect(Object.keys(icons)).toEqual(["defaultIcons"]);
    expect(Object.keys(icons.defaultIcons).length).toBe(32);
  });

  it("@jali/core/agent exports the bridge and its actions", () => {
    expect(Object.keys(agent).sort()).toEqual(["AGENT_ACTIONS", "createAgent"]);
  });

  it("the layout namespace is the pure tree API", () => {
    expect(Object.keys(core.layout).sort()).toMatchSnapshot();
  });
});
