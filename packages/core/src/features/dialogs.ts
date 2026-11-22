/**
 * The framework-free halves of the dialog features: their words and commands. An adapter adds the parts that draw
 * them (`jali/palette`, `jali/settings`, `jali/chooser` give React's), so a workspace without one ships neither.
 */
import { chooserEn, paletteEn, settingsEn } from "../state/feature-messages";
import { messagesOf } from "../state/messages";
import { checkMerge } from "../actions/tabs";
import { also } from "../commands/registry";
import type { Feature } from "./feature";

type Parts = Readonly<Record<string, unknown>>;

/** ⌘K: Jali's command palette. Without it, the app shows Jali's commands in its own menu (`listCommands`), and the
 *  palette's key is the app's unless `keyboard.keymap` binds "palette.toggle". */
export const paletteFeature = (parts?: Parts): Feature => ({
  id: "palette",
  words: paletteEn,
  ...(parts ? { parts } : {}),
});

/** The settings panel (theme, centre drop, pane cap, the keys), and "Open settings" in ⌘K. */
export const settingsFeature = (parts?: Parts): Feature => ({
  id: "settings",
  words: settingsEn,
  commands: (env) => [
    {
      id: "settings.open",
      title: messagesOf(env).commands.settingsOpen,
      group: messagesOf(env).commandGroups.settings,
      after: "peek.open_full",
      run: (u) => u.run("dialogs.openSettings"),
    },
  ],
  ...(parts ? { parts } : {}),
});

/** The chooser: "Add to tabs of…" (⌘K ⌘G) and `jali.dialogs.choose`, an item asked of the person. */
export const chooserFeature = (parts?: Parts): Feature => ({
  id: "chooser",
  words: chooserEn,
  commands: (env) => [
    {
      id: "pane.merge",
      title: messagesOf(env).commands.merge,
      group: messagesOf(env).commandGroups.tabs,
      after: "pane.swap",
      check: also(checkMerge, "move"),
      run: (u) => u.set({ chooser: { kind: "merge", source: u.get().view.focused! } }),
    },
  ],
  ...(parts ? { parts } : {}),
});
