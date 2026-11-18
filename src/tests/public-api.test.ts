/**
 * The packages' public entry points. A change to what "@jali/core" or "@jali/react" exports fails here, so it is made
 * on purpose: update the list, and the docs and changelog with it. "@jali/core/adapter" is for adapters and unchecked.
 */
import { describe, expect, it } from "vitest";
import * as core from "@jali/core";
import * as react from "@jali/react";

describe("public API", () => {
  it("@jali/core exports exactly these values", () => {
    expect(Object.keys(core).sort()).toEqual([
      "DEFAULT_KEYMAP", "DEFAULT_SETTINGS", "GAP", "PALETTE_ID", "activeItemPort", "altClick", "boot", "browserLocation",
      "browserStorage", "commandsOf", "copyLink", "createKeymap", "createPaneKinds", "createUiStore", "createUrlSync",
      "detectPlatform", "focusPane", "formatChord", "formatKeys", "installKeyboard", "keyHint", "layout",
      "memoryLocation", "memoryStorage", "paneDomId", "paneTitleId", "presetById", "resolveTheme", "roleOf",
      "runCommand", "sameRef", "shortcutLabel", "startUi", "titleOf", "viewerLabel",
    ]);
  });

  it("@jali/react exports exactly these values", () => {
    expect(Object.keys(react).sort()).toEqual([
      "Activity", "Announcer", "Chooser", "ConfirmDiscard", "CuratedPage", "Jali", "JaliView", "KindIcon", "PageBar",
      "Palette", "PaneIdContext", "SettingsPanel", "Shelf", "StoreProvider", "Workspace", "definePaneKind",
      "useActions", "useActiveItemPort", "useEnv", "useModel", "usePaneState", "useProfile", "useShortcut",
      "useShortcutSuffix", "useStore", "useTitleOf", "useUi",
    ]);
  });

  it("the layout namespace is the pure tree API", () => {
    expect(Object.keys(core.layout).sort()).toMatchSnapshot();
  });
});
