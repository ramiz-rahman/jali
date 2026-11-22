/**
 * The framework-free halves of the dialog features: their words (their commands are core's: commands/registry.ts). An
 * adapter adds the parts that draw them (`jali/palette`, `jali/settings`, `jali/chooser` give React's), so a workspace
 * without one ships neither.
 */
import { chooserEn, paletteEn, settingsEn } from "../state/feature-messages";
import type { Feature } from "./feature";

type Parts = Readonly<Record<string, unknown>>;

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
  parts,
});

/** The chooser: "Add to tabs of…" (⌘K ⌘G) and `jali.dialogs.choose`, an item asked of the person. */
export const chooserFeature = (parts?: Parts): Feature => ({
  id: "chooser",
  words: chooserEn,
  parts,
});
