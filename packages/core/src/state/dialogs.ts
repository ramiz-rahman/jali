/**
 * An instance's dialogs and which one is on top: the discard question over the chooser, over ⌘K, over Settings. The
 * one beneath comes back when the one above closes, so their order is state's, and every reader asks it here (the
 * keyboard, which leaves the keys to an open dialog; the adapter, which draws the top one).
 */
import type { UiState } from "./store";

/** One of the instance's dialogs. */
export type DialogName = "confirm" | "chooser" | "palette" | "settings";

/** The dialog on top, if one is open. */
export const topDialog = (s: UiState): DialogName | null =>
  s.confirm
    ? "confirm"
    : s.chooser
      ? "chooser"
      : s.paletteOpen
        ? "palette"
        : s.settingsOpen
          ? "settings"
          : null;
