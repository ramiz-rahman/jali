/**
 * The framework-free halves of the dialog features: their words and commands. An adapter adds the parts that draw
 * them (`jali/palette`, `jali/settings`, `jali/chooser` give React's), so a workspace without one ships neither.
 */
import { chooserEn, paletteEn, settingsEn } from "../state/feature-messages";
import { checkMerge } from "../actions/tabs";
import { also } from "../commands/registry";
import { featureCommand, type Feature } from "./feature";

type Parts = Readonly<Record<string, unknown>>;

const openSettings = featureCommand(
  "settings.open",
  "peek.open_full",
  (m) => m.commands.settingsOpen,
  "settings",
  (u) => u.run("dialogs.openSettings"),
);
const merge = featureCommand(
  "pane.merge",
  "pane.swap",
  (m) => m.commands.merge,
  "tabs",
  (u) => u.set({ chooser: { kind: "merge", source: u.get().view.focused! } }),
  also(checkMerge, "move"),
);

/** ⌘K: Jali's command palette. Without it, the app shows Jali's commands in its own menu (`listCommands`), and the
 *  palette's key is the app's unless `keyboard.keymap` binds "palette.toggle". */
export const paletteFeature = (parts?: Parts): Feature => ({
  id: "palette",
  words: paletteEn,
  parts,
});

/** The settings panel (theme, centre drop, pane cap, the keys), and "Open settings" in ⌘K. */
export const settingsFeature = (parts?: Parts): Feature => ({
  id: "settings",
  words: settingsEn,
  commands: (env) => [openSettings(env)],
  parts,
});

/** The chooser: "Add to tabs of…" (⌘K ⌘G) and `jali.dialogs.choose`, an item asked of the person. */
export const chooserFeature = (parts?: Parts): Feature => ({
  id: "chooser",
  words: chooserEn,
  commands: (env) => [merge(env)],
  parts,
});
