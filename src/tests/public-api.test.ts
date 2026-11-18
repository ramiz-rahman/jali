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
      "DEFAULT_KEYMAP", "activeItemPort", "browserLocation", "browserStorage", "column", "commandsOf", "copyLink",
      "createWorkspace", "formatKeys", "keyHint", "layout", "memoryLocation", "memoryStorage", "pane", "row",
      "runCommand", "sameRef", "tabs", "toLayout",
    ]);
  });

  it("@jali/react exports exactly these values", () => {
    expect(Object.keys(react).sort()).toEqual([
      "Activity", "Announcer", "Chooser", "ConfirmDiscard", "CuratedPage", "Jali", "JaliView", "KindIcon", "PageBar",
      "Palette", "Panes", "SettingsPanel", "Shelf", "WorkspaceProvider", "definePage", "definePane", "useActiveItemPort",
      "useActivity", "useCommands", "useLauncher", "usePane", "usePaneState", "useShortcut", "useTheme", "useUnsaved",
      "useWorkspace", "useWorkspaceModel", "useWorkspaceState",
    ]);
  });

  it("the layout namespace is the pure tree API", () => {
    expect(Object.keys(core.layout).sort()).toMatchSnapshot();
  });
});
