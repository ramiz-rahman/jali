/**
 * Jali's dialogs as features, each with the part that draws it: `palette()` (⌘K), `settings()`, `chooser()` ("Add to
 * tabs of…" and `jali.dialogs.choose`). An instance without one renders no such dialog and ships none of its code.
 */
import { chooserFeature, paletteFeature, settingsFeature, type Feature } from "@jali/core/adapter";
import { Palette } from "../dialogs/Palette";
import { SettingsPanel } from "../dialogs/Settings";
import { Chooser } from "../dialogs/Chooser";
import type { ReactParts } from "./feature-parts";

/** ⌘K, Jali's command palette. Leave it out when your app's own command menu lists Jali's commands
 *  (`useSyncExternalStore(jali.subscribe, () => listCommands(jali))`): the palette's key is then yours, unless
 *  `keyboard.keymap` binds "palette.toggle". */
export const palette = (): Feature =>
  paletteFeature({ palette: Palette } satisfies Pick<ReactParts, "palette">);

/** The settings panel (theme, centre drop, pane cap, keys), opened from ⌘K. `<JaliRoot settingsExtra>` adds your
 *  own fieldsets to it. */
export const settings = (): Feature =>
  settingsFeature({ settings: SettingsPanel } satisfies Pick<ReactParts, "settings">);

/** The chooser: "Add to tabs of…" (⌘K ⌘G), and `jali.dialogs.choose` for an item your command asks for. */
export const chooser = (): Feature =>
  chooserFeature({ chooser: Chooser } satisfies Pick<ReactParts, "chooser">);
