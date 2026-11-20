/** The standard's checks on every preset, in both themes: axe and the width sweep; the console guard runs in each. */
import { qualitySuite } from "../../shared/e2e/quality";
import { openPreset, PRESETS } from "./open";

qualitySuite({
  storage: "data-studio",
  layouts: PRESETS.map((name) => ({ name, open: (page) => openPreset(page, name) })),
});
